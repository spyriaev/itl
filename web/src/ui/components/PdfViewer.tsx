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
  const [isMobileInitialScaleApplied, setIsMobileInitialScaleApplied] = useState<boolean>(window.innerWidth >= 1024)
  const [pageQuestionsMap, setPageQuestionsMap] = useState<Map<number, PageQuestionsData>>(new Map())
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [pageWidths, setPageWidths] = useState<Map<number, number>>(new Map())
  const [initialPageWidth, setInitialPageWidth] = useState<number | null>(null)
  const [visiblePageRange, setVisiblePageRange] = useState<{ start: number, end: number }>({ start: 1, end: 10 })
  const [assistantButtonPosition, setAssistantButtonPosition] = useState<{ right: number | string, bottom: number | string }>({ right: 24, bottom: 24 })
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState<boolean>(false)

  // Text selection state
  const [selectionMenu, setSelectionMenu] = useState<{ position: { top: number; left: number }, selectedText: string, pageNumber: number } | null>(null)
  const [floatingAnswer, setFloatingAnswer] = useState<{ selectedText: string, question: string, answer: string, isStreaming: boolean, position?: { top: number; left: number }, questionTimestamp: number, limitError?: { error_type: string, limit_type: string, limit_value: number, current_usage?: number, limit_period: string, message: string } } | null>(null)
  const [selectedTextRange, setSelectedTextRange] = useState<Range | null>(null)
  const [initialChatInputValue, setInitialChatInputValue] = useState<string>('')
  const selectionRangeRef = useRef<Range | null>(null)
  const questionTimestampRef = useRef<number | null>(null)
  const questionPageNumberRef = useRef<number | null>(null)
  const questionThreadIdRef = useRef<string | null>(null)
  const zoomMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const zoomMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileFitToTextAppliedRef = useRef<boolean>(false)
  const initialScaleCalculatedRef = useRef<boolean>(false)
  const prevChatVisibleRef = useRef<boolean>(isChatVisible)
  const prevDocumentUrlRef = useRef<string | null>(null)

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

  const isSafariBrowser = useMemo(() => {
    if (typeof window === 'undefined') return false
    const ua = window.navigator.userAgent
    const vendor = window.navigator.vendor
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Android/.test(ua)
    const isAppleVendor = vendor?.includes('Apple')
    return isSafari || isAppleVendor
  }, [])

  const shouldForceSinglePageMode = useMemo(() => {
    return isSafariBrowser && numPages > 200
  }, [isSafariBrowser, numPages])

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

    const documentUrl = documentInfo.url
    const documentUrlChanged = prevDocumentUrlRef.current !== documentUrl
    if (documentUrlChanged) {
      prevDocumentUrlRef.current = documentUrl
      initialScaleCalculatedRef.current = false
    }

    const chatVisibilityChanged = prevChatVisibleRef.current !== isChatVisible
    prevChatVisibleRef.current = isChatVisible

    if ((isMobile || isTablet) && chatVisibilityChanged && !documentUrlChanged && initialScaleCalculatedRef.current) {
      return
    }

    const calculateScale = async () => {
      try {
        const loadingTask = pdfjs.getDocument({ url: documentUrl })
        const pdf = await loadingTask.promise

        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1.0 })
        const pageWidth = viewport.width

        const container = scrollContainerRef.current
        let availableWidth: number

        if (container) {
          const containerRect = container.getBoundingClientRect()
          availableWidth = containerRect.width - 48
        } else {
          const windowWidth = window.innerWidth
          const chatWidth = isChatVisible && !isMobile ? 400 : 0
          availableWidth = windowWidth - chatWidth - 48
        }

        let optimalScale = availableWidth / pageWidth
        optimalScale = Math.max(0.1, Math.min(optimalScale, 3.0))

        const scaledPageWidth = pageWidth * optimalScale
        setInitialPageWidth(scaledPageWidth)

        setScale(optimalScale)
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = 0
        }

        initialScaleCalculatedRef.current = true

        await pdf.destroy()
      } catch (error) {
        console.error('Error calculating scale:', error)
      }
    }

    calculateScale()
  }, [documentInfo?.url, isChatVisible, isMobile, isTablet])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setIsMobileInitialScaleApplied(true)
      mobileFitToTextAppliedRef.current = false
      return
    }
    if (!mobileFitToTextAppliedRef.current) {
      setIsMobileInitialScaleApplied(false)
    }
  }, [isMobile])

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
  const handleTextSelection = useCallback((e?: MouseEvent | TouchEvent | Event) => {
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

    // Menu dimensions (actual size)
    const menuWidth = 240
    const menuHeight = 180 // Approximate height: header (~60px) + 3 options (~40px each)
    const padding = 8 // Padding from edges
    const spacing = 12 // Spacing between button and menu
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Calculate assistant button position
    const assistantButtonSize = 52
    let buttonRight: number
    let buttonBottom: number
    
    if (typeof assistantButtonPosition.right === 'number') {
      buttonRight = assistantButtonPosition.right
    } else {
      // Parse percentage or default
      buttonRight = 24
    }
    
    if (typeof assistantButtonPosition.bottom === 'number') {
      buttonBottom = assistantButtonPosition.bottom
    } else {
      // Parse percentage or default
      buttonBottom = 24
    }
    
    // Calculate button's actual position (from left and top)
    const buttonLeft = viewportWidth - buttonRight - assistantButtonSize
    const buttonTop = viewportHeight - buttonBottom - assistantButtonSize
    
    // Position menu next to assistant button (to the left of it)
    let menuLeft = buttonLeft - menuWidth - spacing
    let menuTop = buttonTop + (assistantButtonSize / 2) - (menuHeight / 2) // Center vertically with button
    
    // Adjust if menu would go off left edge
    if (menuLeft < padding) {
      // Try positioning to the right of button
      menuLeft = buttonLeft + assistantButtonSize + spacing
      // If still off screen, align to left edge
      if (menuLeft + menuWidth > viewportWidth - padding) {
        menuLeft = padding
      }
    }
    
    // Adjust vertical position if menu would go off screen
    if (menuTop < padding) {
      menuTop = padding
    } else if (menuTop + menuHeight > viewportHeight - padding) {
      // Menu would go off bottom, align to bottom
      menuTop = viewportHeight - menuHeight - padding
    }
    
    // If chat is visible, transfer selected text to chat input instead of showing menu
    if (isChatVisible) {
      setInitialChatInputValue(selectedText)
      // Clear selection menu
      setSelectionMenu(null)
      setSelectedTextRange(null)
      selectionRangeRef.current = null
      // Clear the selection
      selection.removeAllRanges()
      return
    }

    // Final check: ensure menu is fully visible
    menuLeft = Math.max(padding, Math.min(menuLeft, viewportWidth - menuWidth - padding))
    menuTop = Math.max(padding, Math.min(menuTop, viewportHeight - menuHeight - padding))
    
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
  }, [currentPage, isChatVisible])

  // Handle text selection menu option click
  const handleSelectionOptionClick = useCallback(async (option: string, question: string) => {
    if (!selectionMenu) return

    const { selectedText, pageNumber } = selectionMenu

    // Clear text selection immediately
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
    }

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

  // Track selection state to detect when selection is stable
  const selectionStableTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSelectingRef = useRef<boolean>(false)

  // Add mouseup event listener for text selection (desktop)
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Mark that selection is complete
      isSelectingRef.current = false
      
      // Wait for selection to stabilize before showing menu
      if (selectionStableTimeoutRef.current) {
        clearTimeout(selectionStableTimeoutRef.current)
      }
      
      // Capture current selection immediately
      const selection = window.getSelection()
      const initialText = selection?.toString().trim() || ''
      
      if (initialText.length === 0) {
        return
      }
      
      selectionStableTimeoutRef.current = setTimeout(() => {
        // Verify selection hasn't changed
        const finalSelection = window.getSelection()
        const finalText = finalSelection?.toString().trim() || ''
        
        // Only show menu if selection is stable (same text) and user is not selecting
        if (finalText === initialText && finalText.length > 0 && !isSelectingRef.current) {
          handleTextSelection(e)
        }
        selectionStableTimeoutRef.current = null
      }, 150) // Wait 150ms after mouseup to ensure selection is complete (reduced for faster menu appearance)
    }

    const handleMouseDown = () => {
      isSelectingRef.current = true
      // Clear any pending menu when starting new selection
      if (selectionStableTimeoutRef.current) {
        clearTimeout(selectionStableTimeoutRef.current)
        selectionStableTimeoutRef.current = null
      }
      setSelectionMenu(null)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      if (selectionStableTimeoutRef.current) {
        clearTimeout(selectionStableTimeoutRef.current)
      }
    }
  }, [handleTextSelection])

  // Add touchend event listener for text selection (mobile/tablet)
  // Note: This is separate from the context menu prevention handler
  useEffect(() => {
    let touchEndTimeout: NodeJS.Timeout | null = null
    
    const handleTouchEndForSelection = (e: TouchEvent) => {
      // Only process if not a long press (handled by context menu prevention)
      const target = e.target as HTMLElement
      if (target.closest('.react-pdf__Page__textContent')) {
        isSelectingRef.current = false
        
        // Clear any existing timeout
        if (touchEndTimeout) {
          clearTimeout(touchEndTimeout)
        }
        
        // Capture current selection immediately
        const selection = window.getSelection()
        const initialText = selection?.toString().trim() || ''
        
        if (initialText.length === 0) {
          return
        }
        
        // Wait longer for mobile to ensure selection is complete and stable
        touchEndTimeout = setTimeout(() => {
          // Check if selection is stable (hasn't changed)
          const finalSelection = window.getSelection()
          const finalText = finalSelection?.toString().trim() || ''
          
          // Only show menu if selection is stable (same text) and user is not selecting
          if (finalText === initialText && finalText.length > 0 && !isSelectingRef.current) {
            handleTextSelection(e as any)
          }
          touchEndTimeout = null
        }, 250) // Wait 250ms after touchend for mobile (reduced for faster menu appearance)
      }
    }

    const handleTouchStart = () => {
      isSelectingRef.current = true
      // Clear any pending menu when starting new selection
      if (touchEndTimeout) {
        clearTimeout(touchEndTimeout)
        touchEndTimeout = null
      }
      setSelectionMenu(null)
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEndForSelection, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEndForSelection)
      if (touchEndTimeout) {
        clearTimeout(touchEndTimeout)
      }
    }
  }, [handleTextSelection])

  // Track selection changes to detect when selection stabilizes (fallback for mobile)
  useEffect(() => {
    let stabilityCheckTimeout: NodeJS.Timeout | null = null
    
    const handleSelectionChange = () => {
      // If user is actively selecting, don't show menu yet
      if (isSelectingRef.current) {
        // Clear any pending menu
        if (stabilityCheckTimeout) {
          clearTimeout(stabilityCheckTimeout)
        }
        return
      }
      
      const selection = window.getSelection()
      const currentText = selection?.toString().trim() || ''
      
      if (currentText.length === 0) {
        return
      }
      
      // Only show menu if selection is stable (hasn't changed for a while)
      // Clear previous timeout
      if (stabilityCheckTimeout) {
        clearTimeout(stabilityCheckTimeout)
      }
      
      // Wait for selection to stabilize
      stabilityCheckTimeout = setTimeout(() => {
        const finalSelection = window.getSelection()
        const finalText = finalSelection?.toString().trim() || ''
        
        // Only show menu if selection hasn't changed and is not empty
        if (finalText === currentText && finalText.length > 0 && !isSelectingRef.current) {
          // Check if we're on a mobile device
          const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                                (window.innerWidth < 1024 && 'ontouchstart' in window)
          
          // Only use selectionchange for mobile as fallback
          if (isMobileDevice) {
            handleTextSelection(new Event('selectionchange') as any)
          }
        }
        stabilityCheckTimeout = null
      }, 200) // Wait 200ms for selection to stabilize (reduced for faster menu appearance)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      if (stabilityCheckTimeout) {
        clearTimeout(stabilityCheckTimeout)
      }
    }
  }, [handleTextSelection])

  // Prevent default context menu for text layers (all devices)
  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      const target = e.target as HTMLElement
      // Don't prevent if clicking on our custom menu
      if (target.closest('[data-text-selection-menu]')) {
        return
      }
      // Check if the event is on a text layer
      if (target.closest('.react-pdf__Page__textContent')) {
        // Prevent default context menu on all devices
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    // Also handle touchstart with long press to prevent default menu
    let touchStartTime = 0
    let touchStartTarget: HTMLElement | null = null
    
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.react-pdf__Page__textContent')) {
        touchStartTime = Date.now()
        touchStartTarget = target
      }
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                            (window.innerWidth < 1024 && 'ontouchstart' in window)
      
      if (isMobileDevice && touchStartTarget && target.closest('.react-pdf__Page__textContent')) {
        const touchDuration = Date.now() - touchStartTime
        // Prevent default menu for any touch on text layer
        if (touchDuration > 300) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
      touchStartTime = 0
      touchStartTarget = null
    }
    
    // Also prevent context menu on mouse right-click for desktop
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't prevent if clicking on our custom menu
      if (target.closest('[data-text-selection-menu]')) {
        return
      }
      if (target.closest('.react-pdf__Page__textContent')) {
        // Prevent right-click context menu
        if (e.button === 2) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }

    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: false })
    document.addEventListener('mousedown', handleMouseDown, true)
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [])

  // Apply styles to text layers after they're rendered (for mobile support)
  useEffect(() => {
    const applyTextLayerStyles = () => {
      const textLayers = document.querySelectorAll('.react-pdf__Page__textContent')
      textLayers.forEach((layer) => {
        const htmlLayer = layer as HTMLElement
        // Apply styles to prevent default menu on all devices
        htmlLayer.style.setProperty('-webkit-touch-callout', 'none')
        htmlLayer.style.webkitUserSelect = 'text'
        htmlLayer.style.userSelect = 'text'
        
        // Also apply to all child elements
        const allChildren = htmlLayer.querySelectorAll('*')
        allChildren.forEach((child) => {
          const htmlChild = child as HTMLElement
          htmlChild.style.setProperty('-webkit-touch-callout', 'none')
        })
        
        // Also apply to child spans specifically
        const spans = htmlLayer.querySelectorAll('span')
        spans.forEach((span) => {
          const htmlSpan = span as HTMLElement
          htmlSpan.style.setProperty('-webkit-touch-callout', 'none')
        })
      })
    }

    // Apply styles immediately
    applyTextLayerStyles()

    // Also apply styles when new pages are rendered
    const observer = new MutationObserver(() => {
      applyTextLayerStyles()
    })

    // Observe the scroll container for new text layers
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current, {
        childList: true,
        subtree: true
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [numPages, visiblePageRange])

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
      if (continuousScroll) {
        scrollToPage(newPage)
      }
    }
  }

  const goToNextPage = () => {
    if (currentPage < numPages) {
      const newPage = currentPage + 1
      setCurrentPage(newPage)
      saveProgress(newPage)
      if (continuousScroll) {
        scrollToPage(newPage)
      }
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page)
      saveProgress(page)
      if (continuousScroll) {
        scrollToPage(page)
      }
    }
  }

  const toggleContinuousScroll = () => {
    if (shouldForceSinglePageMode) {
      return
    }
    setContinuousScroll(!continuousScroll)

    // Если переключаемся в режим непрерывного скролла, прокручиваем к текущей странице
    if (!continuousScroll) {
      setTimeout(() => {
        scrollToPage(currentPage)
      }, 100)
    }
  }

  useEffect(() => {
    if (continuousScroll) {
      return
    }
    const container = scrollContainerRef.current
    if (!container) {
      return
    }
    // Сбрасываем горизонтальное смещение при переключении страниц
    container.scrollTo({ left: 0, behavior: 'auto' })
  }, [continuousScroll, currentPage])

  const handleZoomMenuAction = useCallback((action: () => void | Promise<unknown>) => {
    const result = action()
    if (result instanceof Promise) {
      result.finally(() => setIsZoomMenuOpen(false))
    } else {
      setIsZoomMenuOpen(false)
    }
  }, [])

  useEffect(() => {
    if (shouldForceSinglePageMode && continuousScroll) {
      setContinuousScroll(false)
    }
  }, [shouldForceSinglePageMode, continuousScroll])

  useEffect(() => {
    if (!isZoomMenuOpen) {
      return
    }
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (
        (zoomMenuRef.current && zoomMenuRef.current.contains(target)) ||
        (zoomMenuButtonRef.current && zoomMenuButtonRef.current.contains(target))
      ) {
        return
      }
      setIsZoomMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick, true)
    document.addEventListener('touchstart', handleOutsideClick, true)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true)
      document.removeEventListener('touchstart', handleOutsideClick, true)
    }
  }, [isZoomMenuOpen])

  // Вычисление позиции кнопки ассистента на основе ширины страницы
  useEffect(() => {
    // На мобильных и планшетах - всегда справа внизу
    if (isMobile || isTablet) {
      setAssistantButtonPosition({ right: isMobile ? 16 : 24, bottom: 24 })
      return
    }

    // На десктопе - позиционируем справа от страницы
    const updateButtonPosition = () => {
      if (!scrollContainerRef.current || !pageRefs.current.length || numPages === 0) {
        // Если страницы еще не загружены, используем дефолтную позицию справа внизу
        setAssistantButtonPosition({ right: 24, bottom: 24 })
        return
      }

      // Находим первую видимую страницу или используем контейнер для определения правого края
      let pageRight: number | null = null
      let pageWidth: number = 0

      // Сначала пытаемся найти видимую страницу
      for (let i = 0; i < pageRefs.current.length; i++) {
        const pageRef = pageRefs.current[i]
        if (pageRef) {
          const pageRect = pageRef.getBoundingClientRect()
          // Проверяем, что страница имеет разумную ширину (больше 200px), чтобы избежать позиционирования относительно узких placeholder'ов
          if (pageRect.width > 200 && pageRect.height > 0) {
            // Находим самый правый край всех видимых страниц
            if (pageRight === null || pageRect.right > pageRight) {
              pageRight = pageRect.right
              pageWidth = pageRect.width
            }
          }
        }
      }

      // Если страница найдена и имеет достаточную ширину, позиционируем кнопку справа от неё
      if (pageRight !== null && pageWidth > 200) {
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
        // Если страница не найдена или слишком узкая, используем дефолтную позицию справа внизу
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
  }, [scale, continuousScroll, currentPage, visiblePageRange, isMobile, isTablet, numPages])

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

  // Fix for iOS Safari: prevent horizontal shift after zoom
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    if (!isIOS) return

    let lastScrollLeft = 0
    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout | null = null

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true
        requestAnimationFrame(() => {
          const currentScrollLeft = container.scrollLeft
          
          // Check if content is actually wider than container
          const contentWidth = container.scrollWidth
          const containerWidth = container.clientWidth
          const shouldFit = contentWidth <= containerWidth + 100 // 100px tolerance for padding
          
          // Only reset if content should fit and scrollLeft changed unexpectedly
          if (shouldFit && Math.abs(currentScrollLeft) > 5) {
            // Clear any pending timeout
            if (scrollTimeout) {
              clearTimeout(scrollTimeout)
            }
            
            // Reset horizontal scroll after a short delay to allow natural scrolling
            scrollTimeout = setTimeout(() => {
              if (container.scrollLeft !== 0 && shouldFit) {
                container.scrollLeft = 0
                lastScrollLeft = 0
              }
            }, 100)
          } else {
            lastScrollLeft = currentScrollLeft
          }
          
          isScrolling = false
        })
      }
    }

    // Handle scroll end to reset position if needed
    const handleScrollEnd = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
        scrollTimeout = null
      }
      
      const contentWidth = container.scrollWidth
      const containerWidth = container.clientWidth
      const shouldFit = contentWidth <= containerWidth + 100
      
      if (shouldFit && Math.abs(container.scrollLeft) > 5) {
        container.scrollLeft = 0
        lastScrollLeft = 0
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    container.addEventListener('touchend', handleScrollEnd, { passive: true })
    container.addEventListener('touchcancel', handleScrollEnd, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('touchend', handleScrollEnd)
      container.removeEventListener('touchcancel', handleScrollEnd)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [])

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

  const fitToWidth = useCallback(async () => {
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
      const containerHorizontalPadding = 48 // padding scroll-контейнера (24px с каждой стороны)
      const mobileCardPaddingX = 0
      const desktopCardPaddingX = 14
      const cardPaddingX = (isMobile || isTablet) ? mobileCardPaddingX : desktopCardPaddingX
      const innerContainerWidth = Math.max(0, containerRect.width - containerHorizontalPadding)
      const viewportPadding = (isMobile || isTablet) ? 16 : 80
      const viewportLimit = typeof window !== 'undefined'
        ? Math.max(0, window.innerWidth - viewportPadding)
        : innerContainerWidth
      const usableWidth = Math.max(0, Math.min(innerContainerWidth, viewportLimit))
      const availableWidth = Math.max(120, usableWidth - cardPaddingX)

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
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0
      }

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
  }, [scale, isMobile, isTablet, updateVisiblePageRange, updateVisiblePage])

  const fitToTextWidth = useCallback(async (): Promise<boolean> => {
    // Предотвращаем множественные одновременные вызовы
    if (isZoomingRef.current) {
      return false
    }

    if (!pdfDocumentRef.current || !scrollContainerRef.current) {
      return false
    }

    try {
      isZoomingRef.current = true
      const oldScale = scale

      // Получаем текущую страницу
      const page = await pdfDocumentRef.current.getPage(currentPage)

      // Проверяем, что компонент еще смонтирован и документ существует
      if (!pdfDocumentRef.current || !scrollContainerRef.current) {
        isZoomingRef.current = false
        return false
      }

      // Получаем доступную ширину контейнера
      const container = scrollContainerRef.current
      if (!container) {
        isZoomingRef.current = false
        return false
      }

      const containerRect = container.getBoundingClientRect()
      const containerHorizontalPadding = 48 // padding scroll-контейнера (24px с каждой стороны)
      const mobileCardPaddingX = 0
      const desktopCardPaddingX = 14
      const cardPaddingX = (isMobile || isTablet) ? mobileCardPaddingX : desktopCardPaddingX
      const innerContainerWidth = Math.max(0, containerRect.width - containerHorizontalPadding)
      const viewportPadding = (isMobile || isTablet) ? 16 : 80
      const viewportLimit = typeof window !== 'undefined'
        ? Math.max(0, window.innerWidth - viewportPadding)
        : innerContainerWidth
      const usableWidth = Math.max(0, Math.min(innerContainerWidth, viewportLimit))
      const availableWidth = Math.max(120, usableWidth - cardPaddingX)

      // Находим текстовый слой текущей страницы
      // react-pdf создает структуру: .react-pdf__Page__textContent > span
      let pageElement = pageRefs.current[currentPage - 1] as HTMLElement | null | undefined
      if (!pageElement && scrollContainerRef.current) {
        pageElement = scrollContainerRef.current.querySelector(`.react-pdf__Page[data-page-number="${currentPage}"]`) as HTMLElement | null
      }
      if (!pageElement) {
        // Если страница не найдена, fallback на fitToWidth
        isZoomingRef.current = false
        await fitToWidth()
        return false
      }

      // Ищем текстовый контент внутри страницы
      const textContent = pageElement.querySelector('.react-pdf__Page__textContent')
      if (!textContent) {
        // Если текстовый слой не загружен, fallback на fitToWidth
        isZoomingRef.current = false
        await fitToWidth()
        return false
      }

      // Находим все текстовые элементы (span)
      const textSpans = textContent.querySelectorAll('span')
      if (textSpans.length === 0) {
        // Если нет текстовых элементов, fallback на fitToWidth
        isZoomingRef.current = false
        await fitToWidth()
        return false
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
        return false
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
      return true
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
      return false
    }
  }, [scale, currentPage, isMobile, isTablet, fitToWidth, updateVisiblePageRange, updateVisiblePage])

  useEffect(() => {
    if (!isMobile) {
      mobileFitToTextAppliedRef.current = false
      return
    }
    if (!isFullyRendered) {
      return
    }
    if (mobileFitToTextAppliedRef.current) {
      return
    }
    let cancelled = false
    let retryTimeout: NodeJS.Timeout | null = null
    const applyFitToText = async (attempt = 0) => {
      try {
        const success = await fitToTextWidth()
        if (cancelled) {
          return
        }
        if (success) {
          mobileFitToTextAppliedRef.current = true
          setIsMobileInitialScaleApplied(true)
          return
        }
        if (attempt < 5) {
          if (retryTimeout) {
            clearTimeout(retryTimeout)
          }
          retryTimeout = setTimeout(() => {
            applyFitToText(attempt + 1)
          }, 200)
        } else {
          mobileFitToTextAppliedRef.current = true
          setIsMobileInitialScaleApplied(true)
        }
      } catch (err) {
        console.error('Failed to apply fit-to-text on mobile:', err)
        if (!cancelled && attempt < 5) {
          if (retryTimeout) {
            clearTimeout(retryTimeout)
          }
          retryTimeout = setTimeout(() => {
            applyFitToText(attempt + 1)
          }, 200)
        } else if (!cancelled) {
          mobileFitToTextAppliedRef.current = true
          setIsMobileInitialScaleApplied(true)
        }
      }
    }
    applyFitToText()
    return () => {
      cancelled = true
      if (retryTimeout) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
    }
  }, [isMobile, isFullyRendered, currentPage, fitToTextWidth])

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

  const prevButtonDisabled = currentPage <= 1
  const nextButtonDisabled = currentPage >= numPages || numPages === 0
  const showPrevNextButtons = !continuousScroll
  const navigationRightOffset = isChatVisible && !isMobile ? 424 : 24
  const navControlTop = isMobile ? undefined : 24
  const navControlHeight = isMobile ? 38 : 48
  const backButtonSize = isMobile ? 38 : 48
  const backButtonTop = isMobile
    ? undefined
    : navControlTop! + navControlHeight / 2 - backButtonSize / 2
  const backButtonTopPosition = navControlTop !== undefined && backButtonTop !== undefined ? backButtonTop : 24
  const backButtonRight = navControlTop !== undefined ? 24 : (isMobile ? 20 : 24)
  const topControlsGap = isMobile ? 8 : 12
  const zoomButtonSize = isMobile ? 26 : 32
  const zoomDisplayValue = useMemo(() => scale.toFixed(1).replace('.', ','), [scale])
  const shouldDelayMobileRender = isMobile && !isMobileInitialScaleApplied
  const singlePageKnownWidth = pageWidths.get(currentPage)
  const singlePageEstimatedWidth = singlePageKnownWidth || initialPageWidth || (scale * 612)
  const singlePageContainerWidth = Math.max(120, (singlePageEstimatedWidth || 0) + 32)

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
      backgroundColor: '#f5f5f5',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Controls */}
      <div
        style={{
          position: 'fixed',
          top: backButtonTopPosition,
          right: backButtonRight,
          display: 'flex',
          alignItems: 'center',
          gap: topControlsGap,
          zIndex: 2000
        }}
      >
        <div style={{ position: 'relative' }}>
          <button
            ref={zoomMenuButtonRef}
            onClick={() => setIsZoomMenuOpen((prev) => !prev)}
            style={{
              height: zoomButtonSize,
              borderRadius: 9999,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              color: 'white',
              fontSize: isMobile ? 8 : 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.2s, transform 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
            aria-haspopup="true"
            aria-expanded={isZoomMenuOpen}
            aria-label={`Open zoom options, current zoom ${zoomDisplayValue}`}
          >
            {`zoom x ${zoomDisplayValue}`}
          </button>
          {isZoomMenuOpen && (
            <div
              ref={zoomMenuRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                backgroundColor: 'white',
                color: '#111827',
                borderRadius: 12,
                boxShadow: '0 25px 50px -12px rgba(30, 64, 175, 0.35)',
                minWidth: isMobile ? 200 : 220,
                maxWidth: 260,
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                zIndex: 2100
              }}
              data-zoom-menu
            >
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color: '#1D4ED8', textTransform: 'uppercase' }}>
                Zoom Options
              </div>
              <button
                onClick={() => handleZoomMenuAction(zoomIn)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1F2937',
                  fontWeight: 500,
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
                  e.currentTarget.style.color = '#1D4ED8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#1F2937'
                }}
              >
                <span style={{ display: 'flex', width: 20, justifyContent: 'center' }}>+</span>
                Zoom In
              </button>
              <button
                onClick={() => handleZoomMenuAction(zoomOut)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1F2937',
                  fontWeight: 500,
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
                  e.currentTarget.style.color = '#1D4ED8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#1F2937'
                }}
              >
                <span style={{ display: 'flex', width: 20, justifyContent: 'center' }}>−</span>
                Zoom Out
              </button>
              <button
                onClick={() => handleZoomMenuAction(resetZoom)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1F2937',
                  fontWeight: 500,
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
                  e.currentTarget.style.color = '#1D4ED8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#1F2937'
                }}
              >
                <span style={{ display: 'flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 5V2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="15 5 12 2 9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Reset Zoom
              </button>
              <div style={{ height: 1, backgroundColor: 'rgba(148, 163, 184, 0.35)', margin: '4px 0' }} />
              <button
                onClick={() => handleZoomMenuAction(fitToWidth)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1F2937',
                  fontWeight: 500,
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
                  e.currentTarget.style.color = '#1D4ED8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#1F2937'
                }}
              >
                <span style={{ display: 'flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4.5" y="5" width="15" height="14" rx="2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="10 9 7 12 10 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="14 9 17 12 14 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Fit to Page Width
              </button>
              <button
                onClick={() => handleZoomMenuAction(fitToTextWidth)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1F2937',
                  fontWeight: 500,
                  transition: 'background-color 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
                  e.currentTarget.style.color = '#1D4ED8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#1F2937'
                }}
              >
                <span style={{ display: 'flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 8H18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M6 12H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M6 16H18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M5 9H4V15H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19 9H20V15H19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                Fit to Text Width
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            width: backButtonSize,
            height: backButtonSize,
            borderRadius: '50%',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 14px -4px rgba(0, 0, 0, 0.35)',
            transition: 'opacity 0.2s, transform 0.2s',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
          aria-label="Back to Library"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D1D5DB"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation Controls */}
      {numPages > 0 && (
        <>
          <div
            style={{
              position: 'fixed',
              top: navControlTop ?? undefined,
              bottom: navControlTop === undefined ? (isMobile ? 24 : 32) : undefined,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2000,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none'
            }}
          >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 6 : 8,
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              color: 'white',
              borderRadius: 9999,
              padding: isMobile ? '6px 12px' : '8px 16px',
              boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(12px)',
              pointerEvents: 'auto',
              position: 'relative'
            }}
          >
            {shouldForceSinglePageMode && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                  transform: isMobile ? 'translate(-50%, calc(-50% - 30px))' : 'translate(-50%, calc(-50% - 35px))',
                  fontSize: isMobile ? 7 : 8,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                padding: '2px 8px',
                backgroundColor: 'rgba(17,24,39,0.85)',
                borderRadius: 9999,
                boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
              }}
            >
              Safari pagination forced
            </div>
            )}
            {showPrevNextButtons && (
              <button
                onClick={goToPrevPage}
                disabled={prevButtonDisabled}
                style={{
                  width: isMobile ? 26 : 32,
                  height: isMobile ? 26 : 32,
                  borderRadius: '9999px',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: prevButtonDisabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
                  color: 'white',
                  cursor: prevButtonDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s, transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!prevButtonDisabled) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.35)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!prevButtonDisabled) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'
                  }
                }}
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
              Page {currentPage} / {numPages}
            </div>
            {showPrevNextButtons && (
              <button
                onClick={goToNextPage}
                disabled={nextButtonDisabled}
                style={{
                  width: isMobile ? 26 : 32,
                  height: isMobile ? 26 : 32,
                  borderRadius: '9999px',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: nextButtonDisabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
                  color: 'white',
                  cursor: nextButtonDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s, transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!nextButtonDisabled) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.35)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!nextButtonDisabled) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'
                  }
                }}
                aria-label="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
          </div>
          {shouldForceSinglePageMode && (
            <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Safari pagination forced
            </div>
          )}
        </>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* PDF Content */}
        <div
          ref={scrollContainerRef}
          data-pdf-scroll-container
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: 24,
            overflowX: 'hidden',
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'auto',
            marginRight: isChatVisible ? (isMobile ? 0 : 400) : 0,
            transition: 'margin-right 0.3s ease-out, opacity 0.2s ease-out',
            position: 'relative',
            opacity: shouldDelayMobileRender ? 0 : 1,
            pointerEvents: shouldDelayMobileRender ? 'none' : 'auto',
            willChange: shouldDelayMobileRender ? 'opacity' : undefined,
            scrollbarGutter: 'stable both-edges',
          }}>
          {shouldDelayMobileRender && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              background: 'linear-gradient(180deg, rgba(245,245,245,0.9) 0%, rgba(245,245,245,0.7) 100%)',
            }}>
              <div style={{
                padding: '12px 20px',
                borderRadius: 9999,
                backgroundColor: 'rgba(17, 24, 39, 0.85)',
                color: 'white',
                fontSize: 13,
                fontWeight: 500,
                boxShadow: '0 10px 18px -6px rgba(0,0,0,0.4)',
              }}>
                Optimizing view…
              </div>
            </div>
          )}
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
                    const knownWidth = pageWidths.get(pageNumber)
                    // Use initialPageWidth if available, otherwise fallback to scale * 612 (standard PDF width)
                    const estimatedWidth = knownWidth || initialPageWidth || (scale * 612)
                    const containerWidth = knownWidth ? knownWidth + 32 : estimatedWidth + 32 // 32px for padding (16px * 2)
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
                          width: '100%',
                          maxWidth: `${containerWidth}px`,
                          margin: '0 auto',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                        }}
                      >
                        {isInRange ? (
                          <>
                            <div
                              ref={(el) => {
                                pdfPageRefs.current[index] = el
                              }}
                              style={{
                                width: '100%',
                                maxWidth: `${estimatedWidth}px`,
                                display: 'flex',
                                justifyContent: 'center',
                                boxSizing: 'border-box',
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
                                    maxWidth: `${estimatedWidth}px`,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    height: `${knownHeight}px`,
                                    backgroundColor: 'white',
                                    borderRadius: 8,
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                    boxSizing: 'border-box',
                                  }}>
                                    {/* Empty placeholder to prevent layout shift */}
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
                            {/* Page number indicator - only show after page is loaded */}
                            {pageWidths.get(pageNumber) && (
                              <div style={{
                                textAlign: 'center',
                                marginTop: 8,
                                fontSize: 12,
                                color: '#6B7280',
                                fontWeight: 500,
                              }}>
                                Page {pageNumber} of {numPages}
                              </div>
                            )}

                            {/* Related questions for this page - only show after page is loaded */}
                            {pageWidths.get(pageNumber) && (
                              <div style={{
                                width: `${pageWidths.get(pageNumber)}px`,
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
                            )}
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
                  // Show minimal loading state that doesn't cause flickering
                  // Use a placeholder with estimated height to prevent layout shift
                  <div style={{
                    width: '100%',
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      opacity: 0,
                      pointerEvents: 'none',
                    }}>
                      {/* Hidden placeholder to prevent layout shift */}
                    </div>
                  </div>
                )}
              </Document>
            </div>
          ) : (
            /* Single Page Mode */
            <div style={{
              backgroundColor: 'white',
              borderRadius: 8,
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              padding: 16,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: `${singlePageContainerWidth}px`,
              boxSizing: 'border-box',
              gap: 8,
            }}>
              <div style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
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
              {pageWidths.get(currentPage) && (
                <div style={{
                  textAlign: 'center',
                  marginTop: 4,
                  fontSize: 12,
                  color: '#6B7280',
                  fontWeight: 500,
                }}>
                  Page {currentPage} of {numPages}
                </div>
              )}
              {pageWidths.get(currentPage) && (
                <div style={{
                  width: `${singlePageEstimatedWidth}px`,
                  maxWidth: 'min(100%, calc(100vw - 80px))',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  margin: '0 auto',
                }}>
                  <PageRelatedQuestions
                    questionsData={pageQuestionsMap.get(currentPage) || null}
                    onQuestionClick={handleQuestionClick}
                    isStreaming={(() => {
                      if (!chatIsStreaming || messages.length === 0) return false
                      const lastUserMessage = [...messages].reverse().find(msg =>
                        msg.role === 'user' &&
                        msg.pageContext === currentPage
                      )
                      if (!lastUserMessage) return false
                      const assistantMessage = messages.find(msg =>
                        msg.role === 'assistant' &&
                        msg.pageContext === currentPage &&
                        messages.indexOf(msg) > messages.indexOf(lastUserMessage)
                      )
                      return !assistantMessage || !assistantMessage.content || assistantMessage.content.trim() === ''
                    })()}
                    currentPageNumber={
                      chatIsStreaming && messages.length > 0
                        ? (() => {
                            const lastUserMessage = [...messages].reverse().find(msg =>
                              msg.role === 'user' &&
                              msg.pageContext === currentPage
                            )
                            return lastUserMessage ? currentPage : undefined
                          })()
                        : undefined
                    }
                    streamingQuestionText={
                      chatIsStreaming && messages.length > 0
                        ? (() => {
                            const lastUserMessage = [...messages].reverse().find(msg =>
                              msg.role === 'user' &&
                              msg.pageContext === currentPage &&
                              msg.content
                            )
                            return lastUserMessage?.content || undefined
                          })()
                        : undefined
                    }
                  />
                </div>
              )}
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
          onOpenChat={() => {
            setIsChatVisible(true)
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

        /* Fix for iOS Safari: prevent horizontal shift after zoom */
        @supports (-webkit-touch-callout: none) {
          /* iOS Safari specific styles */
          [data-pdf-scroll-container] {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior-x: contain;
            overscroll-behavior-y: auto;
          }
          
          .react-pdf__Page {
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
            will-change: transform;
          }
        }

        /* Prevent default text selection menu on all devices */
        .react-pdf__Page__textContent {
          -webkit-touch-callout: none !important;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          user-select: text;
        }

        /* Prevent default context menu for text layers */
        .react-pdf__Page__textContent,
        .react-pdf__Page__textContent * {
          -webkit-touch-callout: none !important;
        }
        
        .react-pdf__Page__textContent span {
          -webkit-touch-callout: none !important;
        }
        
        /* Prevent context menu on all devices */
        .react-pdf__Page__textContent {
          pointer-events: auto;
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