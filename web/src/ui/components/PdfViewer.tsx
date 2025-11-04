import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getDocumentViewUrl, updateViewProgress, DocumentViewInfo } from '../../services/uploadService'
import { chatService, PageQuestionsData } from '../../services/chatService'
import {
  getAllCachedQuestions, cacheAllQuestions, cacheDocumentMetadata,
  getDocumentMetadata, checkForUpdates, initQuestionsCache
} from '../../services/questionsCache'
import { ChatProvider, useChat } from '../../contexts/ChatContext'
import { ChatPanel } from './ChatPanel'
import { PageRelatedQuestions } from './PageRelatedQuestions'
import { ZoomControl } from './ZoomControl'
import { TextSelectionMenu } from './TextSelectionMenu'
import { FloatingAnswer } from './FloatingAnswer'
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
  onRenderComplete?: () => void
}

function PdfViewerContent({ documentId, onClose, preloadedDocumentInfo, onRenderComplete }: PdfViewerProps) {
  const { messages, isStreaming: chatIsStreaming } = useChat()
  const [documentInfo, setDocumentInfo] = useState<DocumentViewInfo | null>(preloadedDocumentInfo || null)
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [loading, setLoading] = useState<boolean>(!preloadedDocumentInfo)
  const [error, setError] = useState<string | null>(null)
  const [isFullyRendered, setIsFullyRendered] = useState<boolean>(false)
  const [continuousScroll, setContinuousScroll] = useState<boolean>(true) // По умолчанию включен непрерывный режим
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 1024)
  const [isTablet, setIsTablet] = useState<boolean>(window.innerWidth >= 640 && window.innerWidth < 1024)
  const [pageQuestionsMap, setPageQuestionsMap] = useState<Map<number, PageQuestionsData>>(new Map())
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [pageWidths, setPageWidths] = useState<Map<number, number>>(new Map())
  const [visiblePageRange, setVisiblePageRange] = useState<{ start: number, end: number }>({ start: 1, end: 10 })
  const [assistantButtonPosition, setAssistantButtonPosition] = useState<{ right: number | string, bottom: number | string }>({ right: 24, bottom: 24 })

  // Text selection state
  const [selectionMenu, setSelectionMenu] = useState<{ position: { top: number; left: number }, selectedText: string, pageNumber: number } | null>(null)
  const [floatingAnswer, setFloatingAnswer] = useState<{ selectedText: string, question: string, answer: string, isStreaming: boolean, position?: { top: number; left: number }, questionTimestamp: number, limitError?: { error_type: string, limit_type: string, limit_value: number, current_usage?: number, limit_period: string, message: string } } | null>(null)
  const [selectedTextRange, setSelectedTextRange] = useState<Range | null>(null)
  const [initialChatInputValue, setInitialChatInputValue] = useState<string>('')
  const selectionRangeRef = useRef<Range | null>(null)
  const questionTimestampRef = useRef<number | null>(null)
  const questionPageNumberRef = useRef<number | null>(null)
  const questionThreadIdRef = useRef<string | null>(null)

  // Refs для отслеживания скролла
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const pdfPageRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Track previous streaming state to detect when message completes
  const prevIsStreamingRef = useRef(chatIsStreaming)
  const lastUserMessagePageRef = useRef<number | null>(null)

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
  
  // Track rendered pages for onRenderComplete callback
  const renderedPagesRef = useRef<Set<number>>(new Set())
  const renderCompleteCalledRef = useRef(false)

  // Get chat context for navigation and assistant state
  const { navigateToMessage, isStreaming, startNewConversation, activeThread, sendMessage } = useChat()

  // Cooldown для форс-восстановления, чтобы не зациклиться пока страницы ещё не смонтировались
  const lastForceRestoreRef = useRef(0)
  // Флаг активного изменения масштаба
  const isZoomingRef = useRef(false)

  // Update current scale ref when scale changes
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
    
    // Reset rendered pages tracking
    renderedPagesRef.current.clear()
    renderCompleteCalledRef.current = false

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
  // Load all questions from cache and sync with server when document opens
  useEffect(() => {
    if (!documentId || numPages === 0) return

    const loadAndSyncQuestions = async () => {
      try {
        // Initialize cache
        await initQuestionsCache()
        
        // Load all questions from cache immediately
        const cachedQuestions = await getAllCachedQuestions(documentId)
        if (cachedQuestions.size > 0) {
          setPageQuestionsMap(cachedQuestions)
        }
        
        // Check for updates on server
        try {
          const metadata = await chatService.getDocumentQuestionsMetadata(documentId)
          const cachedMetadata = await getDocumentMetadata(documentId)
          
          const needsUpdate = !cachedMetadata || 
            await checkForUpdates(documentId, metadata.lastModified)
          
          if (needsUpdate) {
            // Fetch all questions from server
            const allQuestions = await chatService.getAllDocumentQuestions(documentId)
            
            // Update cache
            await cacheAllQuestions(documentId, allQuestions.pages, allQuestions.lastModified)
            await cacheDocumentMetadata(documentId, new Date().toISOString(), allQuestions.lastModified)
            
            // Update state
            const questionsMap = new Map<number, PageQuestionsData>()
            for (const page of allQuestions.pages) {
              questionsMap.set(page.pageNumber, page)
            }
            setPageQuestionsMap(questionsMap)
          }
        } catch (err) {
          // If offline or error, use cached data
          console.warn('Failed to sync questions from server, using cache:', err)
        }
      } catch (err) {
        console.error('Error loading questions:', err)
      }
    }

    loadAndSyncQuestions()
  }, [documentId, numPages])

  const fetchingPagesRef = useRef<Set<number>>(new Set())

  // Update page questions when a new message with page context is completed
  useEffect(() => {
    // Check if streaming just completed
    const wasStreaming = prevIsStreamingRef.current
    const justCompleted = wasStreaming && !chatIsStreaming
    
    if (justCompleted && messages.length > 0) {
      // Find the last user message with pageContext
      const lastUserMessage = [...messages].reverse().find(msg => 
        msg.role === 'user' && msg.pageContext !== undefined && msg.pageContext !== null
      )
      
      if (lastUserMessage && lastUserMessage.pageContext) {
        const pageNum = lastUserMessage.pageContext
        lastUserMessagePageRef.current = pageNum
        
        // Refetch all questions and update cache after a short delay
        const timeoutId = setTimeout(async () => {
          try {
            // Fetch all questions from server to get latest state
            const allQuestions = await chatService.getAllDocumentQuestions(documentId)
            
            // Update cache
            await cacheAllQuestions(documentId, allQuestions.pages, allQuestions.lastModified)
            await cacheDocumentMetadata(documentId, new Date().toISOString(), allQuestions.lastModified)
            
            // Update state
            const questionsMap = new Map<number, PageQuestionsData>()
            for (const page of allQuestions.pages) {
              questionsMap.set(page.pageNumber, page)
            }
            setPageQuestionsMap(questionsMap)
          } catch (err) {
            console.error(`Failed to refresh questions after new message:`, err)
            // Fallback: try to refresh just this page
            try {
              const questionsData = await chatService.getPageQuestions(documentId, pageNum)
              if (questionsData) {
                setPageQuestionsMap(prev => new Map(prev).set(pageNum, questionsData))
                // Update cache for this page
                const cached = await getAllCachedQuestions(documentId)
                cached.set(pageNum, questionsData)
                const pagesArray = Array.from(cached.values())
                const metadata = await getDocumentMetadata(documentId)
                if (metadata) {
                  await cacheAllQuestions(documentId, pagesArray, metadata.lastModified)
                }
              }
            } catch (fallbackErr) {
              console.error(`Failed to refresh questions for page ${pageNum}:`, fallbackErr)
            }
          }
        }, 500) // Small delay to ensure backend has processed the message
        
        return () => clearTimeout(timeoutId)
      }
    }
    
    prevIsStreamingRef.current = chatIsStreaming
  }, [chatIsStreaming, messages, documentId])

  // Handle question click - open full answer in FloatingAnswer
  const handleQuestionClick = useCallback(async (threadId: string, messageId: string) => {
    try {
      // Load thread messages to get full answer
      const threadWithMessages = await chatService.getThreadMessages(threadId)
      
      // Find the question message
      const questionMessage = threadWithMessages.messages.find(msg => msg.id === messageId)
      if (!questionMessage || questionMessage.role !== 'user') {
        // Fallback: open chat panel
        if (!isChatVisible) {
          setIsChatVisible(true)
        }
        navigateToMessage(threadId, messageId)
        return
      }
      
      // Find the index of the question message
      const questionIndex = threadWithMessages.messages.findIndex(msg => msg.id === messageId)
      
      // Find the next assistant message (answer)
      let answerMessage = null
      for (let i = questionIndex + 1; i < threadWithMessages.messages.length; i++) {
        if (threadWithMessages.messages[i].role === 'assistant') {
          answerMessage = threadWithMessages.messages[i]
          break
        }
      }
      
      // Get question text and answer text
      const questionText = questionMessage.content
      const answerText = answerMessage?.content || ''
      
      // Check if answer is still streaming (if activeThread matches and isStreaming is true)
      const isAnswerStreaming = activeThread?.id === threadId && 
                                chatIsStreaming && 
                                (!answerMessage || answerText === '')
      
      // Open FloatingAnswer with full answer
      setFloatingAnswer({
        selectedText: '', // Not needed for question click
        question: questionText,
        answer: answerText,
        isStreaming: isAnswerStreaming,
        position: undefined, // Center the modal
        questionTimestamp: new Date(questionMessage.createdAt).getTime()
      })
      
      // If answer is streaming, track updates
      if (isAnswerStreaming) {
        questionPageNumberRef.current = questionMessage.pageContext || null
        questionTimestampRef.current = new Date(questionMessage.createdAt).getTime()
        questionThreadIdRef.current = threadId
      } else {
        questionThreadIdRef.current = threadId
      }
    } catch (err) {
      console.error('Failed to load thread messages:', err)
      // Fallback: open chat panel
      if (!isChatVisible) {
        setIsChatVisible(true)
      }
      navigateToMessage(threadId, messageId)
    }
  }, [isChatVisible, navigateToMessage, activeThread, chatIsStreaming])

  // Handle text selection
  const handleTextSelection = useCallback((e: MouseEvent) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    const range = selection.getRangeAt(0)
    const selectedText = range.toString().trim()

    // Check if selection is empty or too short
    if (!selectedText || selectedText.length < 2) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    // Limit maximum selection length (prevent selecting entire page)
    const MAX_SELECTION_LENGTH = 5000 // characters
    if (selectedText.length > MAX_SELECTION_LENGTH) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    // Check if both start and end containers are within PDF text layers
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    
    const getTextLayerForNode = (node: Node): HTMLElement | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.parentElement?.closest('.react-pdf__Page__textContent') as HTMLElement) || null
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as HTMLElement).closest('.react-pdf__Page__textContent') as HTMLElement | null
      }
      return null
    }

    const startTextLayer = getTextLayerForNode(startContainer)
    const endTextLayer = getTextLayerForNode(endContainer)

    // Both start and end must be in text layers
    if (!startTextLayer || !endTextLayer) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    // Both must be in the same text layer (same page)
    if (startTextLayer !== endTextLayer) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    const textLayerElement = startTextLayer

    // Additional check: verify that the common ancestor is also within the same text layer
    const commonAncestor = range.commonAncestorContainer
    const commonAncestorTextLayer = getTextLayerForNode(commonAncestor)
    
    if (!commonAncestorTextLayer || commonAncestorTextLayer !== textLayerElement) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    // Additional safety check: ensure the selection doesn't span too many elements
    // Count direct text nodes in the selection to ensure it's reasonable
    let textNodeCount = 0
    const maxTextNodes = 100 // Reasonable limit for a selection
    
    try {
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Only count nodes that are actually within the range
            const nodeRange = document.createRange()
            nodeRange.selectNodeContents(node)
            const startComparison = range.compareBoundaryPoints(Range.START_TO_START, nodeRange)
            const endComparison = range.compareBoundaryPoints(Range.END_TO_END, nodeRange)
            
            // Node is within range if it's not completely before start or after end
            if (startComparison <= 0 && endComparison >= 0 && node.textContent && node.textContent.trim().length > 0) {
              textNodeCount++
              return NodeFilter.FILTER_ACCEPT
            }
            return NodeFilter.FILTER_SKIP
          }
        }
      )
      
      walker.nextNode() // Start walking
      while (walker.nextNode() && textNodeCount < maxTextNodes) {
        // Continue counting
      }
      
      // If we hit the limit, the selection is too large
      if (textNodeCount >= maxTextNodes) {
        setSelectionMenu(null)
        setSelectedTextRange(null)
        selectionRangeRef.current = null
        return
      }
    } catch (err) {
      // If walker fails, reject the selection to be safe
      console.warn('Error validating selection range:', err)
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      return
    }

    // Find the page number by finding the page container
    let pageElement = textLayerElement.closest('[data-page-number]') || textLayerElement.closest('.react-pdf__Page')
    let pageNumber = currentPage

    if (pageElement) {
      // Try to extract page number from data attribute or parent
      const pageNumberAttr = pageElement.getAttribute('data-page-number')
      if (pageNumberAttr) {
        pageNumber = parseInt(pageNumberAttr, 10)
      } else {
        // Find page number by checking which page ref contains this element
        for (let i = 0; i < pageRefs.current.length; i++) {
          if (pageRefs.current[i]?.contains(textLayerElement)) {
            pageNumber = i + 1
            break
          }
        }
      }
    }

    // Get selection position for menu - position at the end of selection
    // Create a range that only contains the end of the selection
    const endRange = range.cloneRange()
    endRange.collapse(false) // Collapse to end point
    const endPoint = endRange.getBoundingClientRect()
    
    // Also get full selection rect for fallback
    const fullRect = range.getBoundingClientRect()
    
    // Use end point if available, otherwise use right edge of full selection
    const endX = endPoint.width > 0 ? endPoint.right : fullRect.right
    const endY = endPoint.height > 0 ? endPoint.bottom : fullRect.bottom
    
    // Calculate menu position at the end of selection
    // Since menu uses position: fixed, we use viewport coordinates directly
    let menuLeft = endX
    let menuTop = endY + 8
    
    // Ensure menu doesn't go off screen (adjust if needed)
    const menuWidth = 200 // Approximate menu width
    const menuHeight = 150 // Approximate menu height
    
    // Adjust horizontal position if menu would go off right edge
    if (menuLeft + menuWidth > window.innerWidth) {
      menuLeft = fullRect.left - menuWidth
    }
    
    // Adjust vertical position if menu would go off bottom edge
    if (menuTop + menuHeight > window.innerHeight) {
      menuTop = fullRect.top - menuHeight - 8
    }
    
    // Ensure menu doesn't go off left edge
    if (menuLeft < 0) {
      menuLeft = 8
    }
    
    // Ensure menu doesn't go off top edge
    if (menuTop < 0) {
      menuTop = endY + 8
    }
    
    const menuPosition = {
      top: menuTop,
      left: menuLeft
    }

    // Save range for animation
    selectionRangeRef.current = range.cloneRange()
    setSelectedTextRange(range.cloneRange())
    setSelectionMenu({
      position: menuPosition,
      selectedText,
      pageNumber
    })
  }, [currentPage])

  // Handle text selection menu option click
  const handleSelectionOptionClick = useCallback(async (option: string, question: string) => {
    if (!selectionMenu) return

    const { selectedText, pageNumber } = selectionMenu

    // Close menu immediately when option is clicked
    setSelectionMenu(null)
    setSelectedTextRange(null)
    selectionRangeRef.current = null

    // Show floating answer with loading state
    // Note: position is optional and will center the modal if not provided
    const answerPosition = undefined

    const timestamp = Date.now()
    questionTimestampRef.current = timestamp
    questionPageNumberRef.current = pageNumber

    setFloatingAnswer({
      selectedText,
      question,
      answer: '',
      isStreaming: true,
      position: answerPosition,
      questionTimestamp: timestamp
    })

    try {
      // Send message without opening chat panel
      if (activeThread) {
        // Use existing thread
        questionThreadIdRef.current = activeThread.id
        await sendMessage(question, pageNumber, 'page', undefined)
      } else {
        // Start new conversation - threadId will be set after thread is created
        questionThreadIdRef.current = null
        await startNewConversation(documentId, question, pageNumber, 'page', undefined)
      }

      // The answer will be updated through the streaming callback
      // We'll track it in a separate effect
    } catch (err: any) {
      console.error('Failed to send message:', err)
      console.log('Error object:', err)
      console.log('Error limitError property:', err?.limitError)
      
      // Try to parse limit exceeded error
      let errorMessage = err instanceof Error ? err.message : 'Failed to send message. Please try again.'
      let limitErrorData: any = null
      
      // Priority 1: Check if limitError is attached to error object
      if (err?.limitError) {
        limitErrorData = err.limitError
        errorMessage = limitErrorData.message || errorMessage
        console.log('✅ Found limitError on error object:', limitErrorData)
      } 
      // Priority 2: Try to parse message as JSON
      else if (err?.message) {
        const message = err.message
        console.log('Error message to parse:', message)
        
        try {
          let parsed: any = null
          if (message.startsWith('{')) {
            parsed = JSON.parse(message)
          } else if (message.startsWith('"')) {
            parsed = JSON.parse(JSON.parse(message))
          }
          
          if (parsed && parsed.error_type === 'limit_exceeded') {
            limitErrorData = parsed
            errorMessage = parsed.message || errorMessage
            console.log('✅ Parsed limit error from message:', limitErrorData)
          }
        } catch (parseErr) {
          console.log('Failed to parse error message:', parseErr)
        }
      }
      
      console.log('Final limitErrorData:', limitErrorData)
      console.log('Final errorMessage:', errorMessage)
      
      setFloatingAnswer(prev => {
        if (!prev) return null
        
        const newState = {
          ...prev,
          answer: errorMessage,
          isStreaming: false,
          limitError: limitErrorData && limitErrorData.error_type === 'limit_exceeded' ? limitErrorData : undefined
        }
        
        console.log('Setting FloatingAnswer with limitError:', newState.limitError)
        return newState
      })
    }
  }, [selectionMenu, activeThread, sendMessage, startNewConversation, documentId])

  // Track streaming answer updates
  useEffect(() => {
    if (floatingAnswer?.isStreaming && questionPageNumberRef.current !== null) {
      // Find assistant messages for the current page
      const pageMessages = messages.filter(msg => 
        msg.role === 'assistant' && 
        msg.pageContext === questionPageNumberRef.current
      )
      
      // Find the user message that matches our question
      const userMessages = messages.filter(msg => 
        msg.role === 'user' && 
        msg.pageContext === questionPageNumberRef.current &&
        msg.content === floatingAnswer.question
      )
      
      let lastAssistantMessage = null
      
      // If we found a matching user message, find the assistant message that comes after it
      if (userMessages.length > 0) {
        const matchingUserMessage = userMessages[userMessages.length - 1]
        const userMessageIndex = messages.indexOf(matchingUserMessage)
        
        // Find the first assistant message after this user message
        for (let i = userMessageIndex + 1; i < messages.length; i++) {
          if (messages[i].role === 'assistant' && 
              messages[i].pageContext === questionPageNumberRef.current) {
            lastAssistantMessage = messages[i]
            break
          }
        }
      }
      
      // Fallback: Try to find message by timestamp
      if (!lastAssistantMessage && questionTimestampRef.current && pageMessages.length > 0) {
        const relevantMessages = pageMessages.filter(msg => {
          try {
            const msgTimestamp = new Date(msg.createdAt).getTime()
            return msgTimestamp >= questionTimestampRef.current!
          } catch {
            return false
          }
        })
        
        if (relevantMessages.length > 0) {
          // Sort by timestamp and get the most recent one
          relevantMessages.sort((a, b) => {
            try {
              const aTime = new Date(a.createdAt).getTime()
              const bTime = new Date(b.createdAt).getTime()
              return bTime - aTime
            } catch {
              return 0
            }
          })
          lastAssistantMessage = relevantMessages[0]
        }
      }
      
      // Final fallback: use the last assistant message for this page (by creation time)
      if (!lastAssistantMessage && pageMessages.length > 0) {
        const sortedMessages = [...pageMessages].sort((a, b) => {
          try {
            const aTime = new Date(a.createdAt).getTime()
            const bTime = new Date(b.createdAt).getTime()
            return bTime - aTime
          } catch {
            return 0
          }
        })
        lastAssistantMessage = sortedMessages[0]
      }

      // Update answer even if it's empty (streaming in progress)
      if (lastAssistantMessage) {
        setFloatingAnswer(prev => {
          if (!prev) return null
          const newContent = lastAssistantMessage.content || ''
          // Always update if content changed (streaming update)
          // This ensures we capture all streaming updates
          if (prev.answer !== newContent) {
            return {
              ...prev,
              answer: newContent,
              isStreaming: chatIsStreaming
            }
          }
          // Also update isStreaming status even if content hasn't changed
          if (prev.isStreaming !== chatIsStreaming) {
            return {
              ...prev,
              isStreaming: chatIsStreaming
            }
          }
          return prev
        })
      }
    }
  }, [messages, floatingAnswer, chatIsStreaming])

  // Close menu when floating answer appears
  useEffect(() => {
    if (floatingAnswer) {
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
    }
  }, [floatingAnswer])

  // Update questionThreadIdRef when activeThread changes (for new conversations)
  useEffect(() => {
    if (floatingAnswer?.isStreaming && activeThread && !questionThreadIdRef.current) {
      questionThreadIdRef.current = activeThread.id
    }
  }, [activeThread, floatingAnswer])

  // Clear floating answer when streaming completes
  useEffect(() => {
    if (floatingAnswer && !isStreaming && floatingAnswer.isStreaming) {
      setFloatingAnswer(prev => prev ? { ...prev, isStreaming: false } : null)
    }
  }, [isStreaming, floatingAnswer])

  // Add text selection animation
  const animatedTextRef = useRef<HTMLElement | null>(null)
  
  useEffect(() => {
    if (!selectedTextRange || !floatingAnswer?.isStreaming) {
      // Remove animation class from animated element
      if (animatedTextRef.current) {
        animatedTextRef.current.classList.remove('text-selection-animated')
        animatedTextRef.current = null
      }
      return
    }

    // Apply animation to selected text using a safer approach
    try {
      const range = selectedTextRange.cloneRange()
      
      // Find the common ancestor container
      const container = range.commonAncestorContainer
      let targetElement: HTMLElement | null = null
      
      if (container.nodeType === Node.TEXT_NODE) {
        targetElement = container.parentElement as HTMLElement
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        targetElement = container as HTMLElement
      }
      
      if (targetElement) {
        // Add animation class to the parent element
        targetElement.classList.add('text-selection-animated')
        animatedTextRef.current = targetElement
        
        // Cleanup function
        return () => {
          if (animatedTextRef.current) {
            animatedTextRef.current.classList.remove('text-selection-animated')
            animatedTextRef.current = null
          }
        }
      }
    } catch (err) {
      console.error('Error applying text selection animation:', err)
    }
  }, [selectedTextRange, floatingAnswer?.isStreaming])

  // Add mouseup event listener for text selection
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Small delay to ensure selection is complete
      setTimeout(() => {
        handleTextSelection(e)
      }, 10)
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleTextSelection])

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
    const oldScale = scale
    const newScale = Math.min(scale + 0.25, 3.0)
    const scaleRatio = newScale / oldScale
    
    // Recalculate page heights and widths proportionally to new scale
    setPageHeights(prev => {
      const newHeights = new Map()
      prev.forEach((height, pageNum) => {
        newHeights.set(pageNum, height * scaleRatio)
      })
      return newHeights
    })
    setPageWidths(prev => {
      const newWidths = new Map()
      prev.forEach((width, pageNum) => {
        newWidths.set(pageNum, width * scaleRatio)
      })
      return newWidths
    })
    
    // Update ref synchronously before setState to prevent race conditions
    currentScaleRef.current = newScale
    setScale(newScale)
    // Update visible range after a brief delay to allow state to update

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
    const oldScale = scale
    const newScale = Math.max(scale - 0.25, 0.5)
    const scaleRatio = newScale / oldScale
    
    // Recalculate page heights and widths proportionally to new scale
    setPageHeights(prev => {
      const newHeights = new Map()
      prev.forEach((height, pageNum) => {
        newHeights.set(pageNum, height * scaleRatio)
      })
      return newHeights
    })
    setPageWidths(prev => {
      const newWidths = new Map()
      prev.forEach((width, pageNum) => {
        newWidths.set(pageNum, width * scaleRatio)
      })
      return newWidths
    })
    
    // Update ref synchronously before setState to prevent race conditions
    currentScaleRef.current = newScale
    setScale(newScale)
    // Update visible range after a brief delay to allow state to update

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
    const oldScale = scale
    const newScale = 1.0
    const scaleRatio = newScale / oldScale
    
    // Recalculate page heights and widths proportionally to new scale
    setPageHeights(prev => {
      const newHeights = new Map()
      prev.forEach((height, pageNum) => {
        newHeights.set(pageNum, height * scaleRatio)
      })
      return newHeights
    })
    setPageWidths(prev => {
      const newWidths = new Map()
      prev.forEach((width, pageNum) => {
        newWidths.set(pageNum, width * scaleRatio)
      })
      return newWidths
    })
    
    // Update ref synchronously before setState to prevent race conditions
    currentScaleRef.current = newScale
    setScale(newScale)
    // Update visible range after a brief delay to allow state to update

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
      const oldScale = scale

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

      const scaleRatio = optimalScale / oldScale
      
      // Recalculate page heights and widths proportionally to new scale
      setPageHeights(prev => {
        const newHeights = new Map()
        prev.forEach((height, pageNum) => {
          newHeights.set(pageNum, height * scaleRatio)
        })
        return newHeights
      })
      setPageWidths(prev => {
        const newWidths = new Map()
        prev.forEach((width, pageNum) => {
          newWidths.set(pageNum, width * scaleRatio)
        })
        return newWidths
      })
      
      // Update ref synchronously before setState to prevent race conditions
      currentScaleRef.current = optimalScale
      setScale(optimalScale)

      // Update visible range after a brief delay to allow state to update
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

  const fitToTextWidth = async () => {
    // Предотвращаем множественные одновременные вызовы
    if (isZoomingRef.current) {
      return
    }

    if (!pdfDocumentRef.current || !scrollContainerRef.current) {
      return
    }

    try {
      isZoomingRef.current = true
      const oldScale = scale

      // Получаем текущую страницу
      const page = await pdfDocumentRef.current.getPage(currentPage)

      // Проверяем, что компонент еще смонтирован и документ существует
      if (!pdfDocumentRef.current || !scrollContainerRef.current) {
        isZoomingRef.current = false
        return
      }

      // Получаем доступную ширину контейнера
      const container = scrollContainerRef.current
      if (!container) {
        isZoomingRef.current = false
        return
      }

      const containerRect = container.getBoundingClientRect()
      const availableWidth = containerRect.width - 48 // Учитываем padding (24px с каждой стороны)

      // Находим текстовый слой текущей страницы
      // react-pdf создает структуру: .react-pdf__Page__textContent > span
      const pageElement = pageRefs.current[currentPage - 1]
      if (!pageElement) {
        // Если страница не найдена, fallback на fitToWidth
        isZoomingRef.current = false
        await fitToWidth()
        return
      }

      // Ищем текстовый контент внутри страницы
      const textContent = pageElement.querySelector('.react-pdf__Page__textContent')
      if (!textContent) {
        // Если текстовый слой не загружен, fallback на fitToWidth
        isZoomingRef.current = false
        await fitToWidth()
        return
      }

      // Находим все текстовые элементы (span)
      const textSpans = textContent.querySelectorAll('span')
      if (textSpans.length === 0) {
        // Если нет текстовых элементов, fallback на fitToWidth
        isZoomingRef.current = false
        await fitToWidth()
        return
      }

      // Вычисляем границы текста (минимальная левая и максимальная правая координаты)
      let minTextLeft = Infinity
      let maxTextRight = -Infinity
      const textContentRect = textContent.getBoundingClientRect()
      
      textSpans.forEach((span) => {
        const rect = span.getBoundingClientRect()
        // Получаем координаты относительно текстового контента
        const relativeLeft = rect.left - textContentRect.left
        const relativeRight = rect.right - textContentRect.left
        minTextLeft = Math.min(minTextLeft, relativeLeft)
        maxTextRight = Math.max(maxTextRight, relativeRight)
      })

      // Если не удалось найти текст, fallback на fitToWidth
      if (maxTextRight === -Infinity || minTextLeft === Infinity) {
        isZoomingRef.current = false
        await fitToWidth()
        return
      }

      // Вычисляем реальную ширину текста (с учетом левой и правой границ)
      const textWidthAtCurrentScale = maxTextRight - minTextLeft

      // Вычисляем ширину текста в масштабе 1.0
      const textWidthAtScale1 = textWidthAtCurrentScale / oldScale

      // Вычисляем оптимальный scale на основе ширины текста
      let optimalScale: number
      
      if (isMobile || isTablet) {
        // Для планшета и мобильных: текст должен полностью помещаться по ширине
        optimalScale = availableWidth / textWidthAtScale1
      } else {
        // Для десктопа: текст помещается по ширине без ограничений
        optimalScale = availableWidth / textWidthAtScale1
      }
      
      // Ограничиваем scale разумными пределами
      // Минимальный scale 0.1 (10%) для очень широких текстов
      // Максимальный scale 3.0 (300%)
      optimalScale = Math.max(0.1, Math.min(optimalScale, 3.0))

      // Очищаем предыдущий таймаут, если он есть
      if (updateVisiblePageRangeTimeoutRef.current) {
        clearTimeout(updateVisiblePageRangeTimeoutRef.current)
        updateVisiblePageRangeTimeoutRef.current = null
      }

      const scaleRatio = optimalScale / oldScale
      
      // Recalculate page heights and widths proportionally to new scale
      setPageHeights(prev => {
        const newHeights = new Map()
        prev.forEach((height, pageNum) => {
          newHeights.set(pageNum, height * scaleRatio)
        })
        return newHeights
      })
      setPageWidths(prev => {
        const newWidths = new Map()
        prev.forEach((width, pageNum) => {
          newWidths.set(pageNum, width * scaleRatio)
        })
        return newWidths
      })
      
      // Update ref synchronously before setState to prevent race conditions
      currentScaleRef.current = optimalScale
      setScale(optimalScale)

      // Update visible range after a brief delay to allow state to update
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
      console.error('Error fitting to text width:', error)
      isZoomingRef.current = false

      // Очищаем таймаут в случае ошибки
      if (updateVisiblePageRangeTimeoutRef.current) {
        clearTimeout(updateVisiblePageRangeTimeoutRef.current)
        updateVisiblePageRangeTimeoutRef.current = null
      }

      // Fallback на fitToWidth в случае ошибки
      isZoomingRef.current = false
      await fitToWidth()
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
            overflowX: 'hidden',
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
                            <div
                              ref={(el) => {
                                pdfPageRefs.current[index] = el
                              }}
                            >
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
                                  const width = viewport.width
                                  setPageHeights(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(pageNumber, height)
                                    return newMap
                                  })
                                  setPageWidths(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(pageNumber, width)
                                    return newMap
                                  })
                                  
                                  // Track rendered pages and call onRenderComplete when first visible pages are ready
                                  if (!renderCompleteCalledRef.current) {
                                    renderedPagesRef.current.add(pageNumber)
                                    
                                    // Check if this page is in the visible range
                                    const isInVisibleRange = pageNumber >= visiblePageRange.start && pageNumber <= visiblePageRange.end
                                    
                                    if (isInVisibleRange) {
                                      // Count how many visible pages have been rendered
                                      let renderedVisibleCount = 0
                                      const visibleRangeSize = visiblePageRange.end - visiblePageRange.start + 1
                                      const minVisiblePages = Math.min(3, visibleRangeSize) // Wait for at least 3 visible pages or all if less
                                      
                                      for (let i = visiblePageRange.start; i <= visiblePageRange.end; i++) {
                                        if (renderedPagesRef.current.has(i)) {
                                          renderedVisibleCount++
                                        }
                                      }
                                      
                                      // When we've rendered enough visible pages, mark as complete
                                      if (renderedVisibleCount >= minVisiblePages) {
                                        renderCompleteCalledRef.current = true
                                        setIsFullyRendered(true)
                                        // Use requestAnimationFrame to ensure DOM is updated
                                        requestAnimationFrame(() => {
                                          onRenderComplete?.()
                                        })
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
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
                            <div style={{
                              width: pageWidths.get(pageNumber) ? `${pageWidths.get(pageNumber)}px` : '100%',
                              maxWidth: 'min(100%, calc(100vw - 80px))',
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                              margin: '0 auto',
                            }}>
                              <PageRelatedQuestions
                                questionsData={pageQuestionsMap.get(pageNumber) || null}
                                onQuestionClick={handleQuestionClick}
                                isStreaming={(() => {
                                  if (!chatIsStreaming || messages.length === 0) return false
                                  // Find the last user message with pageContext matching this page
                                  const lastUserMessage = [...messages].reverse().find(msg =>
                                    msg.role === 'user' &&
                                    msg.pageContext === pageNumber
                                  )
                                  // Show shimmer if there's a user message for this page and streaming is active
                                  // and either no assistant message exists yet, or the assistant message is empty
                                  if (!lastUserMessage) return false
                                  const assistantMessage = messages.find(msg =>
                                    msg.role === 'assistant' &&
                                    msg.pageContext === pageNumber &&
                                    // Find message created after the user message
                                    messages.indexOf(msg) > messages.indexOf(lastUserMessage)
                                  )
                                  return !assistantMessage || !assistantMessage.content || assistantMessage.content.trim() === ''
                                })()}
                                currentPageNumber={
                                  chatIsStreaming && messages.length > 0
                                    ? (() => {
                                        const lastUserMessage = [...messages].reverse().find(msg =>
                                          msg.role === 'user' &&
                                          msg.pageContext === pageNumber
                                        )
                                        return lastUserMessage ? pageNumber : undefined
                                      })()
                                    : undefined
                                }
                                streamingQuestionText={
                                  chatIsStreaming && messages.length > 0
                                    ? (() => {
                                        const lastUserMessage = [...messages].reverse().find(msg =>
                                          msg.role === 'user' &&
                                          msg.pageContext === pageNumber &&
                                          msg.content
                                        )
                                        return lastUserMessage?.content || undefined
                                      })()
                                    : undefined
                                }
                              />
                            </div>
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
                  onLoadSuccess={(page) => {
                    // Call onRenderComplete when single page is loaded
                    if (!renderCompleteCalledRef.current) {
                      renderCompleteCalledRef.current = true
                      setIsFullyRendered(true)
                      requestAnimationFrame(() => {
                        onRenderComplete?.()
                      })
                    }
                  }}
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
                  initialInputValue={initialChatInputValue}
                  onInitialInputValueUsed={() => setInitialChatInputValue('')}
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
            initialInputValue={initialChatInputValue}
            onInitialInputValueUsed={() => setInitialChatInputValue('')}
          />
        )}
      </div>

      {/* Floating Zoom Control */}
      <ZoomControl
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToWidth={fitToWidth}
        onFitToTextWidth={fitToTextWidth}
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
            onClick={() => {
              // Always close selection menu when opening chat
              setSelectionMenu(null)
              setSelectedTextRange(null)
              selectionRangeRef.current = null
              
              // Check if there's a text selection to copy BEFORE clearing
              const selection = window.getSelection()
              let selectedText = ''
              
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                selectedText = range.toString().trim()
                
                // Check if selection is within PDF text layer
                const textContent = range.commonAncestorContainer
                let textLayerElement: HTMLElement | null = null
                
                if (textContent.nodeType === Node.TEXT_NODE) {
                  textLayerElement = (textContent.parentElement?.closest('.react-pdf__Page__textContent') as HTMLElement) || null
                } else if (textContent.nodeType === Node.ELEMENT_NODE) {
                  textLayerElement = (textContent as HTMLElement).closest('.react-pdf__Page__textContent') as HTMLElement | null
                }
                
                if (textLayerElement && selectedText && selectedText.length > 0) {
                  // Copy selected text to chat input
                  setInitialChatInputValue(selectedText)
                }
              }
              
              // Clear browser selection after reading
              if (selection) {
                selection.removeAllRanges()
              }
              
              setIsChatVisible(true)
            }}
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

      {/* Text Selection Menu */}
      {selectionMenu && (
        <TextSelectionMenu
          position={selectionMenu.position}
          selectedText={selectionMenu.selectedText}
          onOptionClick={handleSelectionOptionClick}
          onClose={() => {
            setSelectionMenu(null)
            setSelectedTextRange(null)
            selectionRangeRef.current = null
          }}
        />
      )}

      {/* Floating Answer */}
      {floatingAnswer && (
        <FloatingAnswer
          selectedText={floatingAnswer.selectedText}
          question={floatingAnswer.question}
          answer={floatingAnswer.answer}
          isStreaming={floatingAnswer.isStreaming}
          onClose={() => {
            setFloatingAnswer(null)
            setSelectedTextRange(null)
            selectionRangeRef.current = null
            questionTimestampRef.current = null
            questionPageNumberRef.current = null
            questionThreadIdRef.current = null
          }}
          position={floatingAnswer.position}
          limitError={floatingAnswer.limitError}
        />
      )}

      {/* Add CSS animations */}
      <style>{`
        @keyframes rotate-light {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes textSelectionPulse {
          0%, 100% {
            background-color: rgba(37, 99, 235, 0.2);
            box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4);
          }
          50% {
            background-color: rgba(37, 99, 235, 0.3);
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2);
          }
        }

        .text-selection-animated {
          animation: textSelectionPulse 1.5s ease-in-out infinite;
          border-radius: 2px;
          padding: 0 2px;
          margin: 0 -2px;
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