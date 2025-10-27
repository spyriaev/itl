import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { getDocumentViewUrl, updateViewProgress, DocumentViewInfo } from '../../services/uploadService'
import { chatService, PageQuestionsData } from '../../services/chatService'
import { ChatProvider, useChat } from '../../contexts/ChatContext'
import { ChatPanel } from './ChatPanel'
import { PageRelatedQuestions } from './PageRelatedQuestions'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// Virtualization settings for memory optimization
const PAGES_BUFFER = 3 // Number of pages to render before and after visible pages
const PAGE_HEIGHT_ESTIMATE = 1100 // Estimated height of a page in pixels for virtualization

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
  const [visiblePageRange, setVisiblePageRange] = useState<{start: number, end: number}>({ start: 1, end: 10 })
  
  // Refs для отслеживания скролла
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Track current scale to detect race conditions during zoom operations
  const currentScaleRef = useRef(scale)
  
  // Store timeout ID for updateVisiblePageRange to prevent accumulation
  const updateVisiblePageRangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
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
      setIsMobile(window.innerWidth < 768)
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    // Инициализируем refs для страниц
    pageRefs.current = new Array(numPages).fill(null)
    
    // Initialize visible page range
    const initialEnd = Math.min(numPages, PAGES_BUFFER * 2 + 1)
    setVisiblePageRange({ start: 1, end: initialEnd })
    
    // Прокручиваем к последней просмотренной странице
    setTimeout(() => {
      scrollToPage(currentPage)
      updateVisiblePageRange()
    }, 200)
  }

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

  // Calculate which pages should be rendered based on scroll position
  const updateVisiblePageRange = useCallback(() => {
    if (!continuousScroll || !scrollContainerRef.current || numPages === 0) {
      return
    }

    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight

    // Calculate which pages are in viewport
    let estimatedPage = Math.floor(scrollTop / PAGE_HEIGHT_ESTIMATE) + 1
    estimatedPage = Math.max(1, Math.min(estimatedPage, numPages))

    // Add buffer pages before and after
    const start = Math.max(1, estimatedPage - PAGES_BUFFER)
    const end = Math.min(numPages, estimatedPage + PAGES_BUFFER + Math.ceil(containerHeight / PAGE_HEIGHT_ESTIMATE))

    setVisiblePageRange(prev => {
      if (prev.start !== start || prev.end !== end) {
        console.log(`Rendering pages ${start} to ${end}`)
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
        timeoutId = setTimeout(handleScroll, 100) // Increased for better performance
        rafId = null
      })
    }

    container.addEventListener('scroll', throttledHandleScroll, { passive: true })
    
    // Также добавляем обработчик для изменения размера окна
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

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0))
    // Clear page heights cache when zooming to recalculate
    // Race condition protection: old page callbacks will be ignored automatically
    setPageHeights(new Map())
    // Clear any existing timeout before setting a new one
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    // Update visible range after zoom to adjust for new page sizes
    updateVisiblePageRangeTimeoutRef.current = setTimeout(updateVisiblePageRange, 100)
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
    // Clear page heights cache when zooming to recalculate
    // Race condition protection: old page callbacks will be ignored automatically
    setPageHeights(new Map())
    // Clear any existing timeout before setting a new one
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    // Update visible range after zoom to adjust for new page sizes
    updateVisiblePageRangeTimeoutRef.current = setTimeout(updateVisiblePageRange, 100)
  }

  const resetZoom = () => {
    setScale(1.0)
    // Clear page heights cache when zooming to recalculate
    // Race condition protection: old page callbacks will be ignored automatically
    setPageHeights(new Map())
    // Clear any existing timeout before setting a new one
    if (updateVisiblePageRangeTimeoutRef.current) {
      clearTimeout(updateVisiblePageRangeTimeoutRef.current)
    }
    // Update visible range after zoom to adjust for new page sizes
    updateVisiblePageRangeTimeoutRef.current = setTimeout(updateVisiblePageRange, 100)
  }

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
      {/* Header Controls */}
      <div style={{
        backgroundColor: 'white',
        padding: '16px 24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 12px',
              backgroundColor: '#F3F4F6',
              color: '#374151',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Back to Library
          </button>
          <h2 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: '#111827',
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {documentInfo.title}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Page Navigation - Only show in single page mode */}
          {!continuousScroll && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                style={{
                  padding: '6px 10px',
                  backgroundColor: currentPage <= 1 ? '#F9FAFB' : '#F3F4F6',
                  color: currentPage <= 1 ? '#9CA3AF' : '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ←
              </button>
              <span style={{ fontSize: 14, color: '#374151', minWidth: 80, textAlign: 'center' }}>
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                style={{
                  padding: '6px 10px',
                  backgroundColor: currentPage >= numPages ? '#F9FAFB' : '#F3F4F6',
                  color: currentPage >= numPages ? '#9CA3AF' : '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: currentPage >= numPages ? 'not-allowed' : 'pointer',
                }}
              >
                →
              </button>
            </div>
          )}

          {/* Page count indicator for continuous scroll mode */}
          {continuousScroll && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>
                📄 Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => scrollToPage(currentPage)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                title="Scroll to current page"
              >
                📍
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={zoomOut}
              style={{
                padding: '6px 10px',
                backgroundColor: '#F3F4F6',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <span style={{ fontSize: 14, color: '#374151', minWidth: 50, textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              style={{
                padding: '6px 10px',
                backgroundColor: '#F3F4F6',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              +
            </button>
            <button
              onClick={resetZoom}
              style={{
                padding: '6px 10px',
                backgroundColor: '#F3F4F6',
                color: '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>

          {/* Scroll Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={toggleContinuousScroll}
              style={{
                padding: '6px 12px',
                backgroundColor: continuousScroll ? '#3B82F6' : '#F3F4F6',
                color: continuousScroll ? 'white' : '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {continuousScroll ? '📄 Continuous' : '📖 Single Page'}
            </button>
          </div>

          {/* Chat Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setIsChatVisible(!isChatVisible)}
              style={{
                padding: '6px 12px',
                backgroundColor: isChatVisible ? '#10B981' : '#F3F4F6',
                color: isChatVisible ? 'white' : '#374151',
                border: '1px solid #D1D5DB',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>🤖</span>
              <span>{isChatVisible ? 'Hide AI' : 'Show AI'}</span>
            </button>
          </div>
        </div>
      </div>

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
            >
              {numPages > 0 ? (
                Array.from({ length: numPages }, (_, index) => {
                  const pageNumber = index + 1
                  const isInRange = pageNumber >= visiblePageRange.start && pageNumber <= visiblePageRange.end
                  const knownHeight = pageHeights.get(pageNumber) || PAGE_HEIGHT_ESTIMATE

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
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
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
              onLoadError={(error) => setError('Failed to load PDF document')}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
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
