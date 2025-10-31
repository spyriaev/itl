import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getDocumentViewUrl, updateViewProgress, DocumentViewInfo } from '../../services/uploadService'
import { chatService, PageQuestionsData } from '../../services/chatService'
import { ChatProvider, useChat } from '../../contexts/ChatContext'
import { ChatPanel } from './ChatPanel'
import { PageRelatedQuestions } from './PageRelatedQuestions'
import { ZoomControl } from './ZoomControl'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// Configure PDF.js for better memory management
const pdfOptions = {
  // Disable font caching to save memory
  disableFontFace: false,
  // Enable automatic cleanup
  enableXfa: false,
  // Limit image cache
  maxImageSize: 5242880, // 5MB max per image
  // Use standard font data from CDN to avoid bundling
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
}

// Suppress warning about cancelled text layer tasks
const originalWarn = console.warn
console.warn = (...args: any[]) => {
  if (args[0]?.toString().includes('TextLayer task cancelled')) {
    // Suppress this specific warning
    return
  }
  originalWarn.apply(console, args)
}

// Virtualization settings for memory optimization  
const PAGES_BUFFER = 15 // Number of pages to render before and after visible pages (increased to reduce text layer cancellation)
const PAGE_HEIGHT_ESTIMATE = 1100 // Estimated height of a page in pixels for virtualization
const CLEANUP_INTERVAL = 30000 // Interval to clean up old page data (30 seconds)
const MAX_CACHE_PAGES = PAGES_BUFFER * 4 // Maximum pages to keep in memory (4x buffer size)
const SCROLL_THROTTLE_MS = 50 // Reduced throttle for faster range updates during scrolling

// (оценка переносится ниже хуков состояния)

// (будет вставлено ниже хуков состояния)

interface PdfViewerProps {
  documentId: string
  onClose: () => void
}

function PdfViewerContent({ documentId, onClose }: PdfViewerProps) {
  const [documentInfo, setDocumentInfo] = useState<DocumentViewInfo | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [continuousScroll, setContinuousScroll] = useState<boolean>(true) // По умолчанию включен непрерывный режим
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 1024)
  const [isTablet, setIsTablet] = useState<boolean>(window.innerWidth >= 640 && window.innerWidth < 1024)
  const [pageQuestionsMap, setPageQuestionsMap] = useState<Map<number, PageQuestionsData>>(new Map())
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [visiblePageRange, setVisiblePageRange] = useState<{start: number, end: number}>({ start: 1, end: 10 })
  const [assistantButtonPosition, setAssistantButtonPosition] = useState<{right: number | string, bottom: number | string}>({ right: 24, bottom: 24 })
  
  // Refs для отслеживания скролла
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Track current scale to detect race conditions during zoom operations
  const currentScaleRef = useRef(scale)
  
  // Store timeout ID for updateVisiblePageRange to prevent accumulation
  const updateVisiblePageRangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Store PDF document instance for cleanup
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null)
  
  // Track scroll velocity for dynamic buffering
  const lastScrollTopRef = useRef(0)
  const lastScrollTimeRef = useRef(Date.now())
  const scrollDirectionRef = useRef<'down' | 'up'>('down')
  
  // Get chat context for navigation and assistant state
  const { navigateToMessage, isStreaming } = useChat()
 
  // Cooldown для форс-восстановления, чтобы не зациклиться пока страницы ещё не смонтировались
  const lastForceRestoreRef = useRef(0)
  // Флаг активного изменения масштаба
  const isZoomingRef = useRef(false)

  // Update the ref whenever scale changes
  useEffect(() => {
    currentScaleRef.current = scale
  }, [scale])

  // Базовая оценка высоты страницы (до масштабирования)
  const BASE_PAGE_HEIGHT_ESTIMATE = 1100

  // Возвращает динамическую оценку высоты страницы: средняя из измеренных или базовая * scale
  const getEstimatedPageHeight = () => {
    if (pageHeights.size > 0) {
      let sum = 0
      pageHeights.forEach((h) => (sum += h))
      const avg = sum / pageHeights.size
      return Math.max(300, avg)
    }
    return Math.max(300, BASE_PAGE_HEIGHT_ESTIMATE * scale)
  }

  const estimatePageFromScroll = (scrollTop: number, totalPages: number) => {
    if (pageHeights.size > 0) {
      let acc = 0
      for (let i = 1; i <= totalPages; i++) {
        const h = pageHeights.get(i) || getEstimatedPageHeight()
        acc += h
        if (acc > scrollTop) {
          return i
        }
      }
      return totalPages
    }
    const estHeight = getEstimatedPageHeight()
    return Math.max(1, Math.min(totalPages, Math.floor(scrollTop / estHeight) + 1))
  }

  // Load document info
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Clean up previous document when switching
        if (pdfDocumentRef.current) {
          console.log('Destroying previous PDF document...')
          await pdfDocumentRef.current.destroy().catch((err) => {
            console.error('Error destroying previous PDF document:', err)
          })
          pdfDocumentRef.current = null
        }
        
        // Clear all cached data
        setPageHeights(new Map())
        setPageQuestionsMap(new Map())
        setNumPages(0)
        
        const info = await getDocumentViewUrl(documentId)
        setDocumentInfo(info)
        setCurrentPage(info.lastViewedPage)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [documentId])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Debounced progress saving
  const saveProgress = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout
      return (page: number) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          updateViewProgress(documentId, page).catch(console.error)
        }, 2000)
      }
    })(),
    [documentId]
  )

  // Clean up old page data to prevent memory leaks
  const cleanupOldHeights = useCallback(() => {
    setPageHeights(prev => {
      const currentRange = visiblePageRange
      const startCleanup = Math.max(1, currentRange.start - MAX_CACHE_PAGES)
      const endCleanup = Math.min(numPages, currentRange.end + MAX_CACHE_PAGES)
      
      const cleaned = new Map()
      for (let i = startCleanup; i <= endCleanup; i++) {
        if (prev.has(i)) {
          cleaned.set(i, prev.get(i)!)
        }
      }
      
      if (cleaned.size < prev.size) {
        console.log(`Cleaned up ${prev.size - cleaned.size} pages from memory`)
      }
      
      return cleaned
    })
  }, [visiblePageRange, numPages])

  // Clean up old page questions data
  const cleanupOldQuestions = useCallback(() => {
    setPageQuestionsMap(prev => {
      const currentRange = visiblePageRange
      const startCleanup = Math.max(1, currentRange.start - MAX_CACHE_PAGES)
      const endCleanup = Math.min(numPages, currentRange.end + MAX_CACHE_PAGES)
      
      const cleaned = new Map()
      for (let i = startCleanup; i <= endCleanup; i++) {
        if (prev.has(i)) {
          cleaned.set(i, prev.get(i)!)
        }
      }
      
      return cleaned
    })
  }, [visiblePageRange, numPages])

  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    // Store PDF document instance for cleanup
    pdfDocumentRef.current = pdf
    
    const numPages = pdf.numPages
    setNumPages(numPages)
    // Инициализируем refs для страниц
    pageRefs.current = new Array(numPages).fill(null)
    
    // Initialize visible page range centered around the saved page position
    // Use documentInfo.lastViewedPage directly to avoid race condition with currentPage state
    // This prevents flickering by rendering the correct pages from the start
    const savedPage = documentInfo?.lastViewedPage || 1
    const start = Math.max(1, savedPage - PAGES_BUFFER)
    const end = Math.min(numPages, savedPage + PAGES_BUFFER)
    setVisiblePageRange({ start, end })
    
    // Прокручиваем к последней просмотренной странице
    // Use requestAnimationFrame for smoother, immediate scroll without visible delay
    requestAnimationFrame(() => {
      // scrollToPage will be available when this runs
      const pageRef = pageRefs.current[savedPage - 1]
      if (pageRef && scrollContainerRef.current) {
        const container = scrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const pageRect = pageRef.getBoundingClientRect()
        
        // Вычисляем позицию для центрирования страницы
        const scrollTop = pageRef.offsetTop - containerRect.height / 2 + pageRect.height / 2
        
        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'auto'
        })
      }
    })
  }, [documentInfo?.lastViewedPage])

  // Track fetching state to avoid duplicate requests
  const fetchingPagesRef = useRef<Set<number>>(new Set())

  // Fetch page questions for visible pages
  useEffect(() => {
    if (!documentId || numPages === 0) return

    const fetchPageQuestions = async (pageNumbers: number[]) => {
      const questionsMap = new Map<number, PageQuestionsData>()
      const pagesToFetch = pageNumbers.filter(
        pageNum => !pageQuestionsMap.has(pageNum) && !fetchingPagesRef.current.has(pageNum)
      )
      
      // Mark pages as being fetched
      pagesToFetch.forEach(pageNum => fetchingPagesRef.current.add(pageNum))
      
      // Fetch questions for specified pages only
      for (const pageNum of pagesToFetch) {
        try {
          const questionsData = await chatService.getPageQuestions(documentId, pageNum)
          if (questionsData.totalQuestions > 0) {
            questionsMap.set(pageNum, questionsData)
          }
        } catch (err) {
          console.error(`Failed to fetch questions for page ${pageNum}:`, err)
        } finally {
          fetchingPagesRef.current.delete(pageNum)
        }
      }
      
      if (questionsMap.size > 0) {
        setPageQuestionsMap(prev => new Map([...prev, ...questionsMap]))
      }
    }

    // Determine which pages to fetch
    let pagesToFetch: number[] = []
    
    if (!continuousScroll) {
      // Single page mode - fetch current page
      pagesToFetch = [currentPage]
    } else {
      // Continuous scroll mode - fetch visible pages
      if (pageRefs.current.length > 0 && scrollContainerRef.current) {
        const container = scrollContainerRef.current
        pageRefs.current.forEach((ref, index) => {
          if (ref) {
            const rect = ref.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            
            // Check if page is in viewport
            if (
              rect.bottom >= containerRect.top &&
              rect.top <= containerRect.bottom
            ) {
              pagesToFetch.push(index + 1)
            }
          }
        })
      } else {
        // Fallback: fetch first 10 pages if refs not ready
        pagesToFetch = Array.from({ length: Math.min(10, numPages) }, (_, i) => i + 1)
      }
    }

    fetchPageQuestions(pagesToFetch)
  }, [documentId, numPages, currentPage, continuousScroll])

  // Handle question click - open chat panel and navigate to message
  const handleQuestionClick = useCallback((threadId: string, messageId: string) => {
    if (!isChatVisible) {
      setIsChatVisible(true)
    }
    navigateToMessage(threadId, messageId)
  }, [isChatVisible, navigateToMessage])

  // Функция для прокрутки к определенной странице
  const scrollToPage = useCallback((pageNumber: number) => {
    if (!continuousScroll || !scrollContainerRef.current || pageRefs.current.length === 0) {
      return
    }

    const pageRef = pageRefs.current[pageNumber - 1]
    if (pageRef && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const containerRect = container.getBoundingClientRect()
      const pageRect = pageRef.getBoundingClientRect()
      
      // Вычисляем позицию для центрирования страницы
      const scrollTop = pageRef.offsetTop - containerRect.height / 2 + pageRect.height / 2
      
      console.log(`Scrolling to page ${pageNumber}, scrollTop: ${scrollTop}`)
      
      container.scrollTo({
        top: Math.max(0, scrollTop),
        behavior: 'auto'
      })
    }
  }, [continuousScroll])

  // Буфер теперь мемоизируется на время скролла
  const dynamicBufferRef = useRef(PAGES_BUFFER)
  const bufferTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const setDynamicBuffer = (buffer: number) => {
    if (dynamicBufferRef.current !== buffer) {
      dynamicBufferRef.current = buffer
      // блокируем изменение буфера на 300мс после изменения
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current)
      bufferTimeoutRef.current = setTimeout(() => {
        dynamicBufferRef.current = PAGES_BUFFER
      }, 300)
    }
  }

  const updateVisiblePageRange = useCallback(() => {
    if (!continuousScroll || !scrollContainerRef.current || numPages === 0) {
      return
    }
    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight
    const now = Date.now()
    const timeDelta = now - lastScrollTimeRef.current
    const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current)
    const scrollVelocity = timeDelta > 0 ? scrollDelta / timeDelta : 0
    // Определяем направление скролла
    scrollDirectionRef.current = scrollTop >= lastScrollTopRef.current ? 'down' : 'up'
    lastScrollTopRef.current = scrollTop
    lastScrollTimeRef.current = now

    // Если быстрая прокрутка — увеличиваем буфер, но один раз на цикл скролла
    if (scrollVelocity > 0.5) setDynamicBuffer(PAGES_BUFFER + 5)
    // При маленьком масштабе рендерим больший буфер, чтобы избежать "пустых" зон
    if (scale <= 0.75) setDynamicBuffer(PAGES_BUFFER + 10)

    const buffer = dynamicBufferRef.current
    const estHeight = getEstimatedPageHeight()
    let estimatedPage = estimatePageFromScroll(scrollTop, numPages)

    // Рассчитываем диапазон с учётом реальной высоты контейнера
    const pagesPerViewport = Math.max(1, Math.ceil(containerHeight / estHeight))
    let start: number
    let end: number
    if (isZoomingRef.current) {
      // во время зума гарантируем, что currentPage всегда в диапазоне, а окно стабильное
      const zoomWindow = Math.max(6, Math.floor(buffer / 2))
      start = Math.max(1, currentPage - zoomWindow)
      end = Math.min(numPages, currentPage + zoomWindow)
    } else {
      start = Math.max(1, estimatedPage - buffer)
      end = Math.min(numPages, estimatedPage + buffer + pagesPerViewport)
      // Предзагружаем несколько страниц в направлении скролла
      const lead = isZoomingRef.current ? 5 : 3
      if (scrollDirectionRef.current === 'down') {
        end = Math.min(numPages, end + lead)
      } else {
        start = Math.max(1, start - lead)
      }
    }

    // Всегда включаем currentPage в диапазон на всякий случай
    if (currentPage < start) start = currentPage
    if (currentPage > end) end = currentPage

    if (end < start) {
      start = estimatedPage
      end = estimatedPage + pagesPerViewport
      end = Math.min(numPages, Math.max(start, end))
      console.warn('Fallback (range fix): restoring visiblePageRange window around estimated page', estimatedPage)
    }

    setVisiblePageRange(prev => {
      if (prev.start !== start || prev.end !== end) {
        console.log(`Rendering pages ${start} to ${end} (buffer: ${buffer})`)
        return { start, end }
      }
      return prev
    })
  }, [continuousScroll, numPages, scale, currentPage])

  // Функция для определения видимой страницы при скролле
  const updateVisiblePage = useCallback(() => {
    if (!continuousScroll || !scrollContainerRef.current || pageRefs.current.length === 0) {
      return
    }

    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerTop = containerRect.top
    const containerBottom = containerRect.bottom

    let mostVisiblePage = 1
    let maxVisibleArea = 0

    pageRefs.current.forEach((pageRef, index) => {
      if (pageRef) {
        const pageRect = pageRef.getBoundingClientRect()
        const pageTop = pageRect.top
        const pageBottom = pageRect.bottom
        
        // Вычисляем пересечение страницы с видимой областью
        const visibleTop = Math.max(pageTop, containerTop)
        const visibleBottom = Math.min(pageBottom, containerBottom)
        const visibleHeight = Math.max(0, visibleBottom - visibleTop)
        
        // Вычисляем процент видимости страницы
        const pageHeight = pageRect.height
        const visibilityRatio = visibleHeight / pageHeight

        if (visibilityRatio > maxVisibleArea) {
          maxVisibleArea = visibilityRatio
          mostVisiblePage = index + 1
        }
      }
    })

    if (mostVisiblePage !== currentPage) {
      console.log(`Page changed from ${currentPage} to ${mostVisiblePage} (visibility: ${maxVisibleArea.toFixed(2)})`)
      setCurrentPage(mostVisiblePage)
      saveProgress(mostVisiblePage)
    }

    // Update visible page range for virtualization
    updateVisiblePageRange()
  }, [continuousScroll, currentPage, saveProgress, updateVisiblePageRange])

  // Гарантия восстановления рендера: если после обновления диапазона ничего не видно — форсируем одну страницу
  useEffect(() => {
    if (!continuousScroll || !scrollContainerRef.current || numPages === 0) return

    const container = scrollContainerRef.current
    const containerRect = container.getBoundingClientRect()

    let anyVisible = false
    for (let i = visiblePageRange.start; i <= visiblePageRange.end; i++) {
      const ref = pageRefs.current[i - 1]
      if (ref) {
        const rect = ref.getBoundingClientRect()
        const intersects = rect.bottom >= containerRect.top && rect.top <= containerRect.bottom
        if (intersects) {
          anyVisible = true
          break
        }
      }
    }

    if (!anyVisible) {
      const now = Date.now()
      // ждем немного, чтобы DOM успел смонтировать страницы после смены диапазона
      if (now - lastForceRestoreRef.current < 250) {
        return
      }
      lastForceRestoreRef.current = now
      const scrollTop = container.scrollTop
      const estimatedPage = estimatePageFromScroll(scrollTop, numPages)
      // восстанавливаем небольшое, но достаточное окно (например, 6-10 страниц)
      const minWindow = 8
      const windowHalf = Math.max(minWindow / 2, Math.floor(dynamicBufferRef.current / 4))
      const safeStart = Math.max(1, estimatedPage - windowHalf)
      const safeEnd = Math.min(numPages, estimatedPage + windowHalf)
      if (visiblePageRange.start !== safeStart || visiblePageRange.end !== safeEnd) {
        console.warn('No visible pages in viewport. Forcing restore window around estimated page', estimatedPage)
        setVisiblePageRange({ start: safeStart, end: safeEnd })
      }
    }
  }, [visiblePageRange, continuousScroll, numPages, pageHeights, scale])

  const goToPrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1
      setCurrentPage(newPage)
      saveProgress(newPage)
    }
  }

  const goToNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1
      setCurrentPage(newPage)
      saveProgress(newPage)
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page)
      saveProgress(page)
    }
  }

  const toggleContinuousScroll = () => {
    setContinuousScroll(!continuousScroll)
    
    // Если переключаемся в режим непрерывного скролла, прокручиваем к текущей странице
    if (!continuousScroll) {
      setTimeout(() => {
        scrollToPage(currentPage)
      }, 100)
    }
  }

  // Вычисление позиции кнопки ассистента на основе ширины страницы
  useEffect(() => {
    // На мобильных и планшетах - всегда справа внизу
    if (isMobile || isTablet) {
      setAssistantButtonPosition({ right: isMobile ? 16 : 24, bottom: 24 })
      return
    }

    // На десктопе - позиционируем справа от страницы
    const updateButtonPosition = () => {
      if (!scrollContainerRef.current || !pageRefs.current.length) {
        // Если страницы еще не загружены, используем дефолтную позицию
        setAssistantButtonPosition({ right: 24, bottom: 24 })
        return
      }

      // Находим первую видимую страницу или используем контейнер для определения правого края
      let pageRight: number | null = null
      
      // Сначала пытаемся найти видимую страницу
      for (let i = 0; i < pageRefs.current.length; i++) {
        const pageRef = pageRefs.current[i]
        if (pageRef) {
          const pageRect = pageRef.getBoundingClientRect()
          if (pageRect.width > 0 && pageRect.height > 0) {
            // Находим самый правый край всех видимых страниц
            if (pageRight === null || pageRect.right > pageRight) {
              pageRight = pageRect.right
            }
          }
        }
      }

      if (pageRight !== null) {
        const windowWidth = window.innerWidth
        
        // Кнопка должна быть справа от страницы с отступом 32px (чтобы точно была за пределами)
        // pageRight - координата правого края страницы от левого края окна
        // windowWidth - pageRight - расстояние от правого края страницы до правого края окна
        const offsetFromPage = 32 // отступ от правого края страницы
        const buttonRight = windowWidth - pageRight - offsetFromPage
        
        // Если места недостаточно, размещаем справа внизу экрана
        const minRight = 24
        const finalRight = buttonRight < minRight ? minRight : buttonRight
        
        setAssistantButtonPosition({ right: finalRight, bottom: 24 })
      } else {
        // Если страница не найдена, используем дефолтную позицию
        setAssistantButtonPosition({ right: 24, bottom: 24 })
      }
    }

    // Обновляем позицию при изменении масштаба, скролле или изменении размера окна
    updateButtonPosition()
    
    const handleResize = () => {
      setTimeout(updateButtonPosition, 100)
    }
    
    const handleScroll = () => {
      requestAnimationFrame(updateButtonPosition)
    }

    window.addEventListener('resize', handleResize)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.addEventListener('scroll', handleScroll, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.removeEventListener('scroll', handleScroll)
      }
    }
  }, [scale, continuousScroll, currentPage, visiblePageRange, isMobile, isTablet])
  
  // Отдельный эффект для обновления позиции при открытии/закрытии чата
  useEffect(() => {
    if (isMobile || isTablet) return
    
    // Ждем завершения анимации перехода (300ms + небольшой запас)
    const timeoutId = setTimeout(() => {
      if (!scrollContainerRef.current || !pageRefs.current.length) return

      // Находим самый правый край всех видимых страниц
      let pageRight: number | null = null
      for (let i = 0; i < pageRefs.current.length; i++) {
        const pageRef = pageRefs.current[i]
        if (pageRef) {
          const pageRect = pageRef.getBoundingClientRect()
          if (pageRect.width > 0 && pageRect.height > 0) {
            if (pageRight === null || pageRect.right > pageRight) {
              pageRight = pageRect.right
            }
          }
        }
      }

      if (pageRight !== null) {
        const windowWidth = window.innerWidth
        
        // Кнопка должна быть справа от страницы с отступом 32px
        const offsetFromPage = 32 // отступ от правого края страницы
        const buttonRight = windowWidth - pageRight - offsetFromPage
        
        // Если места недостаточно, размещаем справа внизу экрана
        const minRight = 24
        const finalRight = buttonRight < minRight ? minRight : buttonRight
        setAssistantButtonPosition({ right: finalRight, bottom: 24 })
      }
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [isChatVisible, isMobile, isTablet])

  // Обработчик скролла для отслеживания видимой страницы
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !continuousScroll) return

    const handleScroll = () => {
      updateVisiblePage()
    }

    // Добавляем обработчик с throttling для производительности
    let timeoutId: NodeJS.Timeout
    let rafId: number | null = null
    
    const throttledHandleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      rafId = requestAnimationFrame(() => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(handleScroll, SCROLL_THROTTLE_MS)
        rafId = null
      })
    }

    container.addEventListener('scroll', throttledHandleScroll, { passive: true })
    
    const handleResize = () => {
      setTimeout(handleScroll, 100)
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll)
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [updateVisiblePage, continuousScroll])

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (updateVisiblePageRangeTimeoutRef.current) {
        clearTimeout(updateVisiblePageRangeTimeoutRef.current)
      }
    }
  }, [])

  // Periodic cleanup of old page data
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupOldHeights()
      cleanupOldQuestions()
    }, CLEANUP_INTERVAL)
    
    return () => clearInterval(interval)
  }, [cleanupOldHeights, cleanupOldQuestions])

  // Comprehensive cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up PDF viewer resources...')
      
      // Destroy PDF.js document instance to free memory
      if (pdfDocumentRef.current) {
        pdfDocumentRef.current.destroy().catch((err) => {
          console.error('Error destroying PDF document:', err)
        })
        pdfDocumentRef.current = null
      }
      
      // Clear all state to free memory
      setPageHeights(new Map())
      setPageQuestionsMap(new Map())
      setVisiblePageRange({ start: 1, end: 10 })
      
      // Clear page refs
      pageRefs.current = []
    }
  }, [])

  const zoomIn = () => {
    isZoomingRef.current = true
    setScale(prev => Math.min(prev + 0.25, 3.0))
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      updateVisiblePageRange()
      // Важно: обновляем вычисление наиболее видимой страницы после изменения зума
      requestAnimationFrame(() => {
        updateVisiblePage()
        // Снимаем флаг через небольшой таймаут
        setTimeout(() => { isZoomingRef.current = false }, 200)
      })
    }, 50)
  }

  const zoomOut = () => {
    isZoomingRef.current = true
    setScale(prev => Math.max(prev - 0.25, 0.5))
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      updateVisiblePageRange()
      // Важно: обновляем вычисление наиболее видимой страницы после изменения зума
      requestAnimationFrame(() => {
        updateVisiblePage()
        // Снимаем флаг через небольшой таймаут
        setTimeout(() => { isZoomingRef.current = false }, 200)
      })
    }, 50)
  }

  const resetZoom = () => {
    isZoomingRef.current = true
    setScale(1.0)
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      updateVisiblePageRange()
      // Важно: обновляем вычисление наиболее видимой страницы после изменения зума
      requestAnimationFrame(() => {
        updateVisiblePage()
        // Снимаем флаг через небольшой таймаут
        setTimeout(() => { isZoomingRef.current = false }, 200)
      })
    }, 50)
  }

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch((err) => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      }).catch((err) => {
        console.error('Error attempting to exit fullscreen:', err)
      })
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: 32,
          borderRadius: 12,
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <p style={{ margin: 0, fontSize: 16, color: '#374151' }}>Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: 32,
          borderRadius: 12,
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
          maxWidth: 400,
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>❌</div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600, color: '#111827' }}>
            Error Loading PDF
          </h3>
          <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#6B7280' }}>
            {error}
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#DC2626',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (!documentInfo) {
    return null
  }

  // в отрисовке страниц для continuousScroll
  const WINDOW_RENDER_DISTANCE = 4 // чуть шире окно для textLayer, чтобы не пропадал текст при зуме
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Floating Back Button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 24,
          left: 24,
          zIndex: 2000,
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: '#F0F4FF',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -2px rgb(0 0 0 / 0.2)',
          transition: 'opacity 0.2s',
          padding: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        aria-label="Back to Library"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* PDF Content */}
        <div 
          ref={scrollContainerRef}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: continuousScroll ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: 24,
            overflow: 'auto',
            marginRight: isChatVisible ? (isMobile ? 0 : 400) : 0,
            transition: 'margin-right 0.3s ease-out',
          }}>
        {continuousScroll ? (
          /* Continuous Scroll Mode - Virtualized rendering for memory efficiency */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            width: '100%',
            maxWidth: '100%',
          }}>
            <Document
              file={documentInfo.url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => setError('Failed to load PDF document')}
              options={pdfOptions}
            >
              {numPages > 0 ? (
                Array.from({ length: numPages }, (_, index) => {
                  const pageNumber = index + 1
                  const isInRange = pageNumber >= visiblePageRange.start && pageNumber <= visiblePageRange.end
                  const knownHeight = pageHeights.get(pageNumber) || getEstimatedPageHeight()
                  // Важно: отображаем textLayer только если страница реально "в рабочем окне"
                  const shouldRenderTextLayer = isZoomingRef.current
                    ? Math.abs(pageNumber - currentPage) <= Math.max(4, WINDOW_RENDER_DISTANCE)
                    : Math.abs(pageNumber - currentPage) <= WINDOW_RENDER_DISTANCE
                  return (
                    <div
                      key={pageNumber}
                      ref={(el) => pageRefs.current[index] = el}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: 8,
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        padding: 16,
                        marginBottom: 8,
                        minHeight: isInRange ? 'auto' : `${knownHeight}px`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isInRange ? (
                        <>
                          <Page
                            key={`page-${pageNumber}-scale-${scale}`}
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={shouldRenderTextLayer}
                            renderAnnotationLayer={true}
                            loading={
                              <div style={{
                                width: '100%',
                                height: `${knownHeight}px`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#9CA3AF',
                                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)',
                                backgroundSize: '400% 100%',
                                animation: 'pulse 1.2s ease-in-out infinite',
                                borderRadius: 8,
                              }}>
                                Loading page {pageNumber}...
                              </div>
                            }
                            onLoadSuccess={(page) => {
                              // Get the scale captured in the closure (scale when this Page rendered)
                              const capturedScale = scale
                              // Get the current scale (may have changed due to zoom)
                              const currentScale = currentScaleRef.current
                              
                              // Check if the captured scale still matches the current scale
                              // If not, ignore this callback to prevent race condition during zoom
                              if (capturedScale !== currentScale) {
                                console.log(`Ignoring page ${pageNumber} height (captured: ${capturedScale}, current: ${currentScale})`)
                                return
                              }
                              
                              const viewport = page.getViewport({ scale: capturedScale })
                              const height = viewport.height + 64 // padding + margin
                              setPageHeights(prev => new Map(prev).set(pageNumber, height))
                            }}
                          />
                          {/* Page number indicator */}
                          <div style={{
                            textAlign: 'center',
                            marginTop: 8,
                            fontSize: 12,
                            color: '#6B7280',
                            fontWeight: 500,
                          }}>
                            Page {pageNumber} of {numPages}
                          </div>
                          
                          {/* Related questions for this page */}
                          <PageRelatedQuestions
                            questionsData={pageQuestionsMap.get(pageNumber) || null}
                            onQuestionClick={handleQuestionClick}
                          />
                        </>
                      ) : (
                        <div style={{
                          textAlign: 'center',
                          fontSize: 14,
                          color: '#9CA3AF',
                          padding: '20px',
                        }}>
                          Page {pageNumber}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div style={{
                  backgroundColor: 'white',
                  padding: 32,
                  borderRadius: 12,
                  textAlign: 'center',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
                  <p style={{ margin: 0, fontSize: 16, color: '#374151' }}>Loading PDF pages...</p>
                </div>
              )}
            </Document>
          </div>
        ) : (
          /* Single Page Mode - Original behavior */
          <div style={{
            backgroundColor: 'white',
            borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            padding: 16,
          }}>
            <Document
              file={documentInfo.url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={() => setError('Failed to load PDF document')}
              options={pdfOptions}
            >
              <Page
                key={`page-${currentPage}-scale-${scale}`}
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        )}
        </div>
        {/* End PDF Content */}

        {/* Chat Panel */}
        {isMobile ? (
          isChatVisible ? (
            <div
              onClick={() => setIsChatVisible(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2000,
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'rgba(0,0,0,0.35)'
              }}
            >
              {/* Panel справа */}
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: isTablet ? 'max-content' : '100%',
                  maxWidth: isTablet ? '90vw' : '100%',
                  height: '100%',
                  backgroundColor: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
                  pointerEvents: 'auto',
                  borderRadius: 0,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  margin: 0,
                  position: 'relative',
                  minWidth: 0
                }}
              >
                <ChatPanel
                  documentId={documentId}
                  currentPage={currentPage}
                  isVisible={true}
                  onToggle={() => setIsChatVisible(false)}
                  isMobile={!isTablet}
                />
              </div>
            </div>
          ) : null
        ) : (
          // Sidebar mode for desktop
          <ChatPanel
            documentId={documentId}
            currentPage={currentPage}
            isVisible={isChatVisible}
            onToggle={() => setIsChatVisible(!isChatVisible)}
            isMobile={false}
          />
        )}
      </div>

      {/* Floating Zoom Control */}
      <ZoomControl
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
        isTablet={isTablet}
        isChatVisible={isChatVisible}
        scrollContainerRef={scrollContainerRef}
        isMobile={isMobile}
      />

      {/* Floating Open AI Assistant button (hidden when chat is visible) */}
      {!isChatVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: assistantButtonPosition.bottom,
            right: assistantButtonPosition.right,
            zIndex: 3000,
            width: 52,
            height: 52,
          }}
        >
          {/* Light ray animation */}
          {isStreaming && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(37, 99, 235, 0.7) 90deg, transparent 180deg, rgba(59, 130, 246, 0.7) 270deg, transparent 360deg)',
                animation: 'rotate-light 2s linear infinite',
                pointerEvents: 'none',
              }}
            />
          )}
          <button
            aria-label="Open AI Assistant"
            onClick={() => setIsChatVisible(true)}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#2563EB',
              boxShadow: isStreaming 
                ? '0 0 20px rgba(37, 99, 235, 0.5), 0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -2px rgb(0 0 0 / 0.2)'
                : '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -2px rgb(0 0 0 / 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s, right 0.3s ease, bottom 0.3s ease, box-shadow 0.3s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            title="Open AI Assistant"
          >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
          </button>
        </div>
      )}
      
      {/* Add CSS animation for light rotation */}
      <style>{`
        @keyframes rotate-light {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

// Wrap with ChatProvider
export function PdfViewer(props: PdfViewerProps) {
  return (
    <ChatProvider>
      <PdfViewerContent {...props} />
    </ChatProvider>
  )
}