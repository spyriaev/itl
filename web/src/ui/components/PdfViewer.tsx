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
  preloadedDocumentInfo?: DocumentViewInfo | null
}

function PdfViewerContent({ documentId, onClose, preloadedDocumentInfo }: PdfViewerProps) {
  const [documentInfo, setDocumentInfo] = useState<DocumentViewInfo | null>(preloadedDocumentInfo || null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [loading, setLoading] = useState<boolean>(!preloadedDocumentInfo)
  const [error, setError] = useState<string | null>(null)
  const [continuousScroll, setContinuousScroll] = useState<boolean>(true) // По умолчанию включен непрерывный режим
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 1024)
  const [isTablet, setIsTablet] = useState<boolean>(window.innerWidth >= 640 && window.innerWidth < 1024)
  const [pageQuestionsMap, setPageQuestionsMap] = useState<Map<number, PageQuestionsData>>(new Map())
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [visiblePageRange, setVisiblePageRange] = useState<{ start: number, end: number }>({ start: 1, end: 10 })
  const [assistantButtonPosition, setAssistantButtonPosition] = useState<{ right: number | string, bottom: number | string }>({ right: 24, bottom: 24 })

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

  // Load document info (only if not preloaded)
  useEffect(() => {
    // If documentInfo is already preloaded, use it
    if (preloadedDocumentInfo) {
      setDocumentInfo(preloadedDocumentInfo)
      setCurrentPage(preloadedDocumentInfo.lastViewedPage)
      setLoading(false)
      return
    }

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
  }, [documentId, preloadedDocumentInfo])

  // Calculate initial scale to avoid flickering (PDF is already loaded on document list screen)
  useEffect(() => {
    if (!documentInfo?.url) return

    const calculateScale = async () => {
      try {
        // PDF document should already be loaded/cached from the document list screen
        // Load PDF document (should be fast if cached)
        const loadingTask = pdfjs.getDocument({ url: documentInfo.url })
        const pdf = await loadingTask.promise

        // Calculate optimal scale
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1.0 })
        const pageWidth = viewport.width

        // Get available container width
        const container = scrollContainerRef.current
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const availableWidth = containerRect.width - 48 // Account for padding (24px on each side)

          // Calculate optimal scale
          let optimalScale = availableWidth / pageWidth

          // Clamp scale to reasonable limits
          optimalScale = Math.max(0.1, Math.min(optimalScale, 3.0))

          // Set initial scale before rendering
          setScale(optimalScale)

          // Clean up the PDF (we only used it for scale calculation)
          await pdf.destroy()
        }
      } catch (error) {
        console.error('Error calculating scale:', error)
      }
    }

    calculateScale()
  }, [documentInfo?.url])

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

  const onDocumentLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
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

      // Очищаем все таймауты
      if (updateVisiblePageRangeTimeoutRef.current) {
        clearTimeout(updateVisiblePageRangeTimeoutRef.current)
        updateVisiblePageRangeTimeoutRef.current = null
      }

      // Сбрасываем флаг зума
      isZoomingRef.current = false

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
    // Предотвращаем множественные одновременные вызовы
    if (isZoomingRef.current) {
      return
    }

    if (!scrollContainerRef.current) {
      return
    }

    isZoomingRef.current = true
    setScale(prev => Math.min(prev + 0.25, 3.0))
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()

    // Очищаем предыдущий таймаут, если он есть
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
      updateVisiblePageRangeTimeoutRef.current = null
    }

    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      // Проверяем, что компонент еще смонтирован
      if (!scrollContainerRef.current) {
        isZoomingRef.current = false
        return
      }

      updateVisiblePageRange()
      // Важно: обновляем вычисление наиболее видимой страницы после изменения зума
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) {
          isZoomingRef.current = false
          return
        }

        updateVisiblePage()
        // Снимаем флаг через небольшой таймаут
        setTimeout(() => { isZoomingRef.current = false }, 200)
      })
    }, 50)
  }

  const zoomOut = () => {
    // Предотвращаем множественные одновременные вызовы
    if (isZoomingRef.current) {
      return
    }

    if (!scrollContainerRef.current) {
      return
    }

    isZoomingRef.current = true
    setScale(prev => Math.max(prev - 0.25, 0.5))
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()

    // Очищаем предыдущий таймаут, если он есть
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
      updateVisiblePageRangeTimeoutRef.current = null
    }

    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      // Проверяем, что компонент еще смонтирован
      if (!scrollContainerRef.current) {
        isZoomingRef.current = false
        return
      }

      updateVisiblePageRange()
      // Важно: обновляем вычисление наиболее видимой страницы после изменения зума
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) {
          isZoomingRef.current = false
          return
        }

        updateVisiblePage()
        // Снимаем флаг через небольшой таймаут
        setTimeout(() => { isZoomingRef.current = false }, 200)
      })
    }, 50)
  }

  const resetZoom = () => {
    // Предотвращаем множественные одновременные вызовы
    if (isZoomingRef.current) {
      return
    }

    if (!scrollContainerRef.current) {
      return
    }

    isZoomingRef.current = true
    setScale(1.0)
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()

    // Очищаем предыдущий таймаут, если он есть
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
      updateVisiblePageRangeTimeoutRef.current = null
    }

    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      // Проверяем, что компонент еще смонтирован
      if (!scrollContainerRef.current) {
        isZoomingRef.current = false
        return
      }

      updateVisiblePageRange()
      // Важно: обновляем вычисление наиболее видимой страницы после изменения зума
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) {
          isZoomingRef.current = false
          return
        }

        updateVisiblePage()
        // Снимаем флаг через небольшой таймаут
        setTimeout(() => { isZoomingRef.current = false }, 200)
      })
    }, 50)
  }

  const fitToWidth = async () => {
    // Предотвращаем множественные одновременные вызовы
    if (isZoomingRef.current) {
      return
    }

    if (!pdfDocumentRef.current || !scrollContainerRef.current) {
      return
    }

    try {
      isZoomingRef.current = true

      // Получаем первую страницу для определения ширины (все страницы обычно имеют одинаковую ширину)
      const page = await pdfDocumentRef.current.getPage(1)

      // Проверяем, что компонент еще смонтирован и документ существует
      if (!pdfDocumentRef.current || !scrollContainerRef.current) {
        isZoomingRef.current = false
        return
      }

      const viewport = page.getViewport({ scale: 1.0 })
      const pageWidth = viewport.width

      // Получаем доступную ширину контейнера
      const container = scrollContainerRef.current
      if (!container) {
        isZoomingRef.current = false
        return
      }

      const containerRect = container.getBoundingClientRect()
      const availableWidth = containerRect.width - 48 // Учитываем padding (24px с каждой стороны)

      // Вычисляем оптимальный scale
      let optimalScale: number
      
      if (isMobile || isTablet) {
        // Для планшета и мобильных: страница должна полностью помещаться по ширине
        optimalScale = availableWidth / pageWidth
      } else {
        // Для десктопа: страница помещается по ширине без ограничений
        // Для очень широких презентаций это может привести к зуму меньше 50%
        optimalScale = availableWidth / pageWidth
      }
      
      // Ограничиваем scale разумными пределами
      // Минимальный scale 0.1 (10%) для очень широких презентаций
      // Максимальный scale 3.0 (300%)
      optimalScale = Math.max(0.1, Math.min(optimalScale, 3.0))

      // Очищаем предыдущий таймаут, если он есть
      if (updateVisiblePageRangeTimeoutRef.current) {
        clearTimeout(updateVisiblePageRangeTimeoutRef.current)
        updateVisiblePageRangeTimeoutRef.current = null
      }

      setScale(optimalScale)
      // Clear page heights cache when zooming to recalculate
      setPageHeights(new Map())

      // Update visible range immediately and after a brief delay for re-render
      updateVisiblePageRange()

      updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
        // Проверяем, что компонент еще смонтирован
        if (!scrollContainerRef.current) {
          isZoomingRef.current = false
          return
        }

        updateVisiblePageRange()
        requestAnimationFrame(() => {
          if (!scrollContainerRef.current) {
            isZoomingRef.current = false
            return
          }

          updateVisiblePage()
          setTimeout(() => {
            isZoomingRef.current = false
          }, 200)
        })
      }, 50)
    } catch (error) {
      console.error('Error fitting to width:', error)
      isZoomingRef.current = false

      // Очищаем таймаут в случае ошибки
      if (updateVisiblePageRangeTimeoutRef.current) {
        clearTimeout(updateVisiblePageRangeTimeoutRef.current)
        updateVisiblePageRangeTimeoutRef.current = null
      }
    }
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

  // Show minimal loading state only if documentInfo is not yet loaded
  // If preloadedDocumentInfo was provided, we should already have documentInfo and loading should be false
  if (!documentInfo || loading) {
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
          padding: 16,
          borderRadius: 8,
          textAlign: 'center',
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151' }}>Opening document...</p>
        </div>
      </div>
    )
  }

  // At this point documentInfo is guaranteed to be non-null
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
            minWidth: 'max-content',
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
        onFitToWidth={fitToWidth}
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
          {/* Light ray animation - behind button */}
          {isStreaming && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '120%',
                height: '120%',
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(37, 99, 235, 0.7) 90deg, transparent 180deg, rgba(59, 130, 246, 0.7) 270deg, transparent 360deg)',
                animation: 'rotate-light 2s linear infinite',
                pointerEvents: 'none',
                zIndex: 0,
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
              zIndex: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            title="Open AI Assistant"
          >

            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5.75 21.25H15.45C17.1302 21.25 17.9702 21.25 18.612 20.923C19.1765 20.6354 19.6354 20.1765 19.923 19.612C20.25 18.9702 20.25 18.1302 20.25 16.45V10.9882C20.25 10.2545 20.25 9.88757 20.1671 9.5423C20.0936 9.2362 19.9724 8.94356 19.8079 8.67515C19.6224 8.3724 19.363 8.11297 18.8441 7.59411L15.4059 4.15589C14.887 3.63703 14.6276 3.37761 14.3249 3.19208C14.0564 3.02759 13.7638 2.90638 13.4577 2.83289C13.1124 2.75 12.7455 2.75 12.0118 2.75H9.875H9.25C8.78558 2.75 8.55337 2.75 8.35842 2.77567C7.01222 2.9529 5.9529 4.01222 5.77567 5.35842C5.75 5.55337 5.75 5.78558 5.75 6.25" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13.75 2.75V4.45C13.75 6.13016 13.75 6.97024 14.077 7.61197C14.3646 8.17646 14.8235 8.6354 15.388 8.92302C16.0298 9.25 16.8698 9.25 18.55 9.25H20.25" stroke="white" strokeWidth="1.5" />
              <path d="M9.33687 15.1876L8.67209 17.2136C8.53833 17.6213 7.96167 17.6213 7.82791 17.2136L7.16313 15.1876C7.03098 14.7849 6.71511 14.469 6.31236 14.3369L4.28637 13.6721C3.87872 13.5383 3.87872 12.9617 4.28637 12.8279L6.31236 12.1631C6.71511 12.031 7.03098 11.7151 7.16313 11.3124L7.82791 9.28637C7.96167 8.87872 8.53833 8.87872 8.67209 9.28637L9.33687 11.3124C9.46902 11.7151 9.78489 12.031 10.1876 12.1631L12.2136 12.8279C12.6213 12.9617 12.6213 13.5383 12.2136 13.6721L10.1876 14.3369C9.78489 14.469 9.46902 14.7849 9.33687 15.1876Z" fill="white" />
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