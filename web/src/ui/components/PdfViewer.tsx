"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { getDocumentViewUrl, updateViewProgress, type DocumentViewInfo } from "../../services/uploadService"
import { chatService, type PageQuestionsData } from "../../services/chatService"
import { ChatProvider, useChat } from "../../contexts/ChatContext"
import { ChatPanel } from "./ChatPanel"
import { PageRelatedQuestions } from "./PageRelatedQuestions"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

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
  if (args[0]?.toString().includes("TextLayer task cancelled")) {
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
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [pageQuestionsMap, setPageQuestionsMap] = useState<Map<number, PageQuestionsData>>(new Map())
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [visiblePageRange, setVisiblePageRange] = useState<{ start: number; end: number }>({ start: 1, end: 10 })

  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true)
  const [lastScrollY, setLastScrollY] = useState<number>(0)

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

  // Get chat context for navigation
  const { navigateToMessage } = useChat()

  // Update the ref whenever scale changes
  useEffect(() => {
    currentScaleRef.current = scale
  }, [scale])

  // Load document info
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)

        // Clean up previous document when switching
        if (pdfDocumentRef.current) {
          console.log("Destroying previous PDF document...")
          await pdfDocumentRef.current.destroy().catch((err) => {
            console.error("Error destroying previous PDF document:", err)
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
        setError(err instanceof Error ? err.message : "Failed to load document")
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [documentId])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
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
    [documentId],
  )

  // Clean up old page data to prevent memory leaks
  const cleanupOldHeights = useCallback(() => {
    setPageHeights((prev) => {
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
    setPageQuestionsMap((prev) => {
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

  const onDocumentLoadSuccess = useCallback(
    (pdf: PDFDocumentProxy) => {
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
            behavior: "auto",
          })
        }
      })
    },
    [documentInfo?.lastViewedPage],
  )

  // Track fetching state to avoid duplicate requests
  const fetchingPagesRef = useRef<Set<number>>(new Set())

  // Fetch page questions for visible pages
  useEffect(() => {
    if (!documentId || numPages === 0) return

    const fetchPageQuestions = async (pageNumbers: number[]) => {
      const questionsMap = new Map<number, PageQuestionsData>()
      const pagesToFetch = pageNumbers.filter(
        (pageNum) => !pageQuestionsMap.has(pageNum) && !fetchingPagesRef.current.has(pageNum),
      )

      // Mark pages as being fetched
      pagesToFetch.forEach((pageNum) => fetchingPagesRef.current.add(pageNum))

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
        setPageQuestionsMap((prev) => new Map([...prev, ...questionsMap]))
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
            if (rect.bottom >= containerRect.top && rect.top <= containerRect.bottom) {
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
  const handleQuestionClick = useCallback(
    (threadId: string, messageId: string) => {
      if (!isChatVisible) {
        setIsChatVisible(true)
      }
      navigateToMessage(threadId, messageId)
    },
    [isChatVisible, navigateToMessage],
  )

  // Функция для прокрутки к определенной странице
  const scrollToPage = useCallback(
    (pageNumber: number) => {
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
          behavior: "auto",
        })
      }
    },
    [continuousScroll],
  )

  // Calculate which pages should be rendered based on scroll position
  const updateVisiblePageRange = useCallback(() => {
    if (!continuousScroll || !scrollContainerRef.current || numPages === 0) {
      return
    }

    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight

    // Calculate scroll velocity for dynamic buffering
    const now = Date.now()
    const timeDelta = now - lastScrollTimeRef.current
    const scrollDelta = Math.abs(scrollTop - lastScrollTopRef.current)
    const scrollVelocity = timeDelta > 0 ? scrollDelta / timeDelta : 0

    lastScrollTopRef.current = scrollTop
    lastScrollTimeRef.current = now

    // Dynamically adjust buffer based on scroll velocity
    // Faster scrolling = larger buffer to prevent unmounting
    const dynamicBuffer = scrollVelocity > 0.5 ? PAGES_BUFFER + 5 : PAGES_BUFFER

    // Calculate which pages are in viewport
    let estimatedPage = Math.floor(scrollTop / PAGE_HEIGHT_ESTIMATE) + 1
    estimatedPage = Math.max(1, Math.min(estimatedPage, numPages))

    // Add buffer pages before and after with dynamic buffer size
    const start = Math.max(1, estimatedPage - dynamicBuffer)
    const end = Math.min(numPages, estimatedPage + dynamicBuffer + Math.ceil(containerHeight / PAGE_HEIGHT_ESTIMATE))

    setVisiblePageRange((prev) => {
      if (prev.start !== start || prev.end !== end) {
        console.log(`Rendering pages ${start} to ${end} (buffer: ${dynamicBuffer})`)
        return { start, end }
      }
      return prev
    })
  }, [continuousScroll, numPages])

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

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const currentScrollY = container.scrollTop

      // Show controls when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY) {
        // Scrolling up - show controls
        setIsControlsVisible(true)
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down and past threshold - hide controls
        setIsControlsVisible(false)
      }

      // Always show controls at the top of the document
      if (currentScrollY < 50) {
        setIsControlsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    // Throttle scroll handler for performance
    let timeoutId: NodeJS.Timeout
    const throttledHandleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleScroll, 100)
    }

    container.addEventListener("scroll", throttledHandleScroll, { passive: true })

    return () => {
      container.removeEventListener("scroll", throttledHandleScroll)
      clearTimeout(timeoutId)
    }
  }, [lastScrollY])

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

    // If switching to continuous scroll mode, scroll to the current page
    if (!continuousScroll) {
      setTimeout(() => {
        scrollToPage(currentPage)
      }, 100)
    }
  }

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
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      // Use requestAnimationFrame for smoother updates
      rafId = requestAnimationFrame(() => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(handleScroll, SCROLL_THROTTLE_MS) // Reduced for better responsiveness
        rafId = null
      })
    }

    container.addEventListener("scroll", throttledHandleScroll, { passive: true })

    // Также добавляем обработчик для изменения размера окна
    const handleResize = () => {
      setTimeout(handleScroll, 100)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      container.removeEventListener("scroll", throttledHandleScroll)
      window.removeEventListener("resize", handleResize)
      clearTimeout(timeoutId)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [updateVisiblePage, continuousScroll])

  // Дополнительная проверка видимой страницы каждые 500ms
  useEffect(() => {
    if (!continuousScroll) return

    const interval = setInterval(() => {
      updateVisiblePage()
    }, 500)

    return () => clearInterval(interval)
  }, [continuousScroll, updateVisiblePage])

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
      console.log("Cleaning up PDF viewer resources...")

      // Destroy PDF.js document instance to free memory
      if (pdfDocumentRef.current) {
        pdfDocumentRef.current.destroy().catch((err) => {
          console.error("Error destroying PDF document:", err)
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
    setScale((prev) => Math.min(prev + 0.25, 3.0))
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      updateVisiblePageRange()
    }, 50)
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
    // Clear page heights cache when zooming to recalculate
    setPageHeights(new Map())
    // Update visible range immediately and after a brief delay for re-render
    updateVisiblePageRange()
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    updateVisiblePageRangeTimeoutRef.current = setTimeout(() => {
      updateVisiblePageRange()
    }, 50)
  }

  const resetZoom = () => {
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
    }, 50)
  }

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: 32,
            borderRadius: 12,
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
          <p style={{ margin: 0, fontSize: 16, color: "#374151" }}>Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            padding: 32,
            borderRadius: 12,
            textAlign: "center",
            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
            maxWidth: 400,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 16 }}>❌</div>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 600, color: "#111827" }}>Error Loading PDF</h3>
          <p style={{ margin: "0 0 24px 0", fontSize: 14, color: "#6B7280" }}>{error}</p>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              backgroundColor: "#DC2626",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
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

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: isMobile ? "12px 16px" : "16px 24px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
          transition: "transform 0.3s ease-in-out, opacity 0.3s ease-in-out",
          transform: isControlsVisible ? "translateY(0)" : "translateY(-100%)",
          opacity: isControlsVisible ? 1 : 0,
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Left: Back button */}
        <button
          onClick={onClose}
          style={{
            padding: isMobile ? "6px 10px" : "8px 12px",
            backgroundColor: "#F3F4F6",
            color: "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: 6,
            fontSize: isMobile ? 12 : 14,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          ←{!isMobile && " Back"}
        </button>

        {/* Center: Page indicator */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: isMobile ? 12 : 14,
            color: "#374151",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {isMobile ? `${currentPage}/${numPages}` : `Страница ${currentPage} из ${numPages}`}
        </div>

        {/* Right: Continuous scroll toggle and chat button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={toggleContinuousScroll}
            style={{
              padding: isMobile ? "6px 10px" : "6px 12px",
              backgroundColor: continuousScroll ? "#3B82F6" : "#F3F4F6",
              color: continuousScroll ? "white" : "#374151",
              border: "1px solid #D1D5DB",
              borderRadius: 6,
              fontSize: isMobile ? 11 : 12,
              cursor: "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>📄</span>
            {!isMobile && <span>Continuous</span>}
          </button>

          {/* Chat Toggle - only show on larger screens */}
          {!isMobile && (
            <button
              onClick={() => setIsChatVisible(!isChatVisible)}
              style={{
                padding: "6px 12px",
                backgroundColor: isChatVisible ? "#10B981" : "#F3F4F6",
                color: isChatVisible ? "white" : "#374151",
                border: "1px solid #D1D5DB",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>🤖</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* PDF Content */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            display: "flex",
            alignItems: continuousScroll ? "flex-start" : "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
            overflow: "auto",
            marginRight: isChatVisible ? (isMobile ? 0 : 400) : 0,
            transition: "margin-right 0.3s ease-out",
          }}
        >
          {continuousScroll ? (
            /* Continuous Scroll Mode - Virtualized rendering for memory efficiency */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                width: "100%",
                maxWidth: "100%",
              }}
            >
              <Document
                file={documentInfo.url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => setError("Failed to load PDF document")}
                options={pdfOptions}
              >
                {numPages > 0 ? (
                  Array.from({ length: numPages }, (_, index) => {
                    const pageNumber = index + 1
                    const isInRange = pageNumber >= visiblePageRange.start && pageNumber <= visiblePageRange.end
                    const knownHeight = pageHeights.get(pageNumber) || PAGE_HEIGHT_ESTIMATE

                    return (
                      <div
                        key={pageNumber}
                        ref={(el) => (pageRefs.current[index] = el)}
                        style={{
                          backgroundColor: "white",
                          borderRadius: 8,
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          padding: isMobile ? 8 : 16,
                          marginBottom: 8,
                          minHeight: isInRange ? "auto" : `${knownHeight}px`,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isInRange ? (
                          <>
                            <Page
                              key={`page-${pageNumber}-scale-${scale}`}
                              pageNumber={pageNumber}
                              scale={scale}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              loading={
                                <div
                                  style={{
                                    width: "100%",
                                    height: "500px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#9CA3AF",
                                  }}
                                >
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
                                  console.log(
                                    `Ignoring page ${pageNumber} height (captured: ${capturedScale}, current: ${currentScale})`,
                                  )
                                  return
                                }

                                const viewport = page.getViewport({ scale: capturedScale })
                                const height = viewport.height + 64 // padding + margin
                                setPageHeights((prev) => new Map(prev).set(pageNumber, height))
                              }}
                            />
                            {/* Page number indicator */}
                            <div
                              style={{
                                textAlign: "center",
                                marginTop: 8,
                                fontSize: 12,
                                color: "#6B7280",
                                fontWeight: 500,
                              }}
                            >
                              Page {pageNumber} of {numPages}
                            </div>

                            {/* Related questions for this page */}
                            <PageRelatedQuestions
                              questionsData={pageQuestionsMap.get(pageNumber) || null}
                              onQuestionClick={handleQuestionClick}
                            />
                          </>
                        ) : (
                          <div
                            style={{
                              textAlign: "center",
                              fontSize: 14,
                              color: "#9CA3AF",
                              padding: "20px",
                            }}
                          >
                            Page {pageNumber}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div
                    style={{
                      backgroundColor: "white",
                      padding: 32,
                      borderRadius: 12,
                      textAlign: "center",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
                    <p style={{ margin: 0, fontSize: 16, color: "#374151" }}>Loading PDF pages...</p>
                  </div>
                )}
              </Document>
            </div>
          ) : (
            /* Single Page Mode - Original behavior */
            <div
              style={{
                backgroundColor: "white",
                borderRadius: 8,
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                padding: 16,
              }}
            >
              <Document
                file={documentInfo.url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => setError("Failed to load PDF document")}
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

        {/* Chat Panel */}
        <ChatPanel
          documentId={documentId}
          currentPage={currentPage}
          isVisible={isChatVisible}
          onToggle={() => setIsChatVisible(!isChatVisible)}
          isMobile={isMobile}
        />
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: `translateX(-50%) translateY(${isControlsVisible ? "0" : "100%"})`,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(10px)",
          padding: isMobile ? "12px 20px" : "16px 24px",
          borderRadius: "12px 12px 0 0",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 12 : 16,
          boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.3)",
          transition: "transform 0.3s ease-in-out, opacity 0.3s ease-in-out",
          opacity: isControlsVisible ? 1 : 0,
          zIndex: 100,
          minWidth: isMobile ? "90%" : "auto",
          justifyContent: "center",
        }}
      >
        {/* Zoom Out */}
        <button
          onClick={zoomOut}
          disabled={scale <= 0.5}
          style={{
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
            backgroundColor: scale <= 0.5 ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.9)",
            color: scale <= 0.5 ? "rgba(255, 255, 255, 0.5)" : "#374151",
            border: "none",
            borderRadius: 8,
            fontSize: isMobile ? 18 : 20,
            cursor: scale <= 0.5 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (scale > 0.5) {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)"
              e.currentTarget.style.transform = "scale(1.05)"
            }
          }}
          onMouseLeave={(e) => {
            if (scale > 0.5) {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)"
              e.currentTarget.style.transform = "scale(1)"
            }
          }}
        >
          −
        </button>

        {/* Zoom Percentage Display */}
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            color: "#374151",
            padding: isMobile ? "8px 16px" : "10px 20px",
            borderRadius: 8,
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            minWidth: isMobile ? 60 : 70,
            textAlign: "center",
          }}
        >
          {Math.round(scale * 100)}%
        </div>

        {/* Zoom In */}
        <button
          onClick={zoomIn}
          disabled={scale >= 3.0}
          style={{
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
            backgroundColor: scale >= 3.0 ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.9)",
            color: scale >= 3.0 ? "rgba(255, 255, 255, 0.5)" : "#374151",
            border: "none",
            borderRadius: 8,
            fontSize: isMobile ? 18 : 20,
            cursor: scale >= 3.0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (scale < 3.0) {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)"
              e.currentTarget.style.transform = "scale(1.05)"
            }
          }}
          onMouseLeave={(e) => {
            if (scale < 3.0) {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)"
              e.currentTarget.style.transform = "scale(1)"
            }
          }}
        >
          +
        </button>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: isMobile ? 24 : 28,
            backgroundColor: "rgba(255, 255, 255, 0.3)",
          }}
        />

        {/* Fullscreen Button */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen()
            } else {
              document.exitFullscreen()
            }
          }}
          style={{
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            color: "#374151",
            border: "none",
            borderRadius: 8,
            fontSize: isMobile ? 16 : 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 1)"
            e.currentTarget.style.transform = "scale(1.05)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)"
            e.currentTarget.style.transform = "scale(1)"
          }}
          title="Toggle Fullscreen"
        >
          ⛶
        </button>
      </div>
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
