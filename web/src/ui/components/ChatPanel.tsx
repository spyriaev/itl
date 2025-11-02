import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { ChatMessage } from './ChatMessage'
import { ThreadSelector } from './ThreadSelector'
import { ChatInput } from './ChatInput'
import { ContextType, ChapterInfo, DocumentStructureItem } from '../../types/document'
import { getChapterForPage, getDocumentStructure } from '../../services/documentService'

interface ChatPanelProps {
  documentId: string
  currentPage?: number
  isVisible: boolean
  onToggle: () => void
  isMobile?: boolean
}

export function ChatPanel({ documentId, currentPage, isVisible, onToggle, isMobile = false }: ChatPanelProps) {
  const {
    activeThread,
    messages,
    threads,
    isLoading,
    isStreaming,
    error,
    targetMessageId,
    loadThreads,
    selectThread,
    createNewThread,
    sendMessage,
    startNewConversation,
    clearError,
  } = useChat()

  const [inputValue, setInputValue] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<number | null | 'none'>(null)
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo | null>(null)
  const [documentStructure, setDocumentStructure] = useState<any>(null)
  const [contextItems, setContextItems] = useState<DocumentStructureItem[]>([])
  const userSelectionRef = useRef<number | null | 'none'>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevMessagesLengthRef = useRef<number>(0)
  const renderedMessageIdsRef = useRef<Set<string>>(new Set())
  const prevTargetMessageIdRef = useRef<string | null>(null)

  // Load threads when document changes
  useEffect(() => {
    if (documentId) {
      loadThreads(documentId)
    }
  }, [documentId, loadThreads])

  // Reset rendered messages when switching threads
  useEffect(() => {
    renderedMessageIdsRef.current.clear()
  }, [activeThread?.id])

  // Auto-scroll to bottom when new messages arrive or scroll to target message
  useEffect(() => {
    const wasNavigating = prevTargetMessageIdRef.current !== null
    
    try {
      if (targetMessageId) {
        // Scroll to specific message
        const targetElement = messageRefs.current.get(targetMessageId)
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Add highlight animation
          targetElement.style.animation = 'highlight 2s ease-out'
          setTimeout(() => {
            if (targetElement.style) {
              targetElement.style.animation = ''
            }
          }, 2000)
        }
      } else if (!wasNavigating && messages.length > prevMessagesLengthRef.current) {
        // Only auto-scroll to bottom when new messages are added
        // Don't scroll when targetMessageId was just cleared
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (error) {
      // Silently fail if scrolling cannot be performed (e.g., due to browser extensions)
    }
    
    // Update refs
    prevMessagesLengthRef.current = messages.length
    prevTargetMessageIdRef.current = targetMessageId
  }, [messages, targetMessageId])

  // Load document structure when document loads
  useEffect(() => {
    const loadStructure = async () => {
      if (documentId) {
        try {
          const structure = await getDocumentStructure(documentId)
          setDocumentStructure(structure)
        } catch (error) {
          console.error('Failed to load document structure:', error)
        }
      }
    }

    loadStructure()
  }, [documentId])

  // Find only the specific parent chain for the current page
  const findContextItemsForPage = (items: DocumentStructureItem[], page: number): DocumentStructureItem[] => {
    const path: DocumentStructureItem[] = []
    
    const findPath = (items: DocumentStructureItem[], page: number): boolean => {
      for (const item of items) {
        if (item.pageFrom <= page && (item.pageTo === null || page <= item.pageTo)) {
          // Add to path if this item contains the page
          path.push(item)
          
          // Try to find deeper items in children
          if (item.children && item.children.length > 0) {
            if (findPath(item.children, page)) {
              return true
            }
          }
          
          // This is the deepest item on this branch, so stop
          return true
        }
      }
      return false
    }
    
    findPath(items, page)
    return path.sort((a, b) => a.level - b.level)
  }

  // Track user manual selection changes in ContextSelector
  const handleContextChange = useCallback((level: number | null | 'none') => {
    userSelectionRef.current = level
    setSelectedLevel(level)
  }, [])

  // Load context items when page changes
  useEffect(() => {
    if (currentPage && documentStructure) {
      const items = findContextItemsForPage(documentStructure.items, currentPage)
      
      // Keep all items in the path (for displaying chapter info)
      const deepestItem = items.length > 0 ? items[items.length - 1] : null
      
      if (deepestItem) {
        const previousItem = contextItems[0]
        
        // Pass all items in the path to ChatInput so it can find the chapter
        setContextItems(items)
        setChapterInfo({
          id: deepestItem.id,
          title: deepestItem.title,
          level: deepestItem.level,
          pageFrom: deepestItem.pageFrom,
          pageTo: deepestItem.pageTo
        })
        
        // Don't auto-change user's selection if they chose 'none' or 'null'
        // Only auto-update if user previously selected a section
        if (selectedLevel !== null && selectedLevel !== 'none') {
          // User previously selected a section, update to new section level
          setSelectedLevel(deepestItem.level)
        }
        // If selectedLevel is null or 'none', don't change it - let user choose manually
      } else {
        setChapterInfo(null)
        setContextItems([])
        if (selectedLevel !== null) {
          setSelectedLevel(null)
        }
      }
    }
  }, [currentPage, documentStructure, selectedLevel])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return

    const message = inputValue.trim()
    setInputValue('')

    // Determine context type and chapter ID based on selected level
    if (selectedLevel === 'none') {
      // Send without any context
      try {
        if (activeThread) {
          await sendMessage(message, undefined, undefined, undefined)
        } else {
          await startNewConversation(documentId, message, undefined, undefined, undefined)
        }
      } catch (err) {
        console.error('Failed to send message:', err)
      }
      return
    }

    const selectedItem = contextItems.find(item => item.level === selectedLevel)
    const contextType = selectedLevel === null ? 'page' : 'section'
    const chapterId = selectedItem?.id

    try {
      if (activeThread) {
        // Send message to existing thread
        await sendMessage(message, currentPage, contextType, chapterId)
      } else {
        // Start new conversation
        await startNewConversation(documentId, message, currentPage, contextType, chapterId)
      }
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleNewThread = async () => {
    try {
      await createNewThread(documentId)
    } catch (err) {
      console.error('Failed to create thread:', err)
    }
  }

  const suggestedPrompts = [
    "What is this document about?",
    "Can you summarize the main points?",
    "What are the key concepts discussed?",
    "Can you explain this in simpler terms?",
  ]

  if (!isVisible) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: isMobile ? '100%' : 400,
      backgroundColor: 'white',
      borderLeft: isMobile ? 'none' : '1px solid #E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: isMobile ? '0 0 20px rgba(0, 0, 0, 0.3)' : '-4px 0 12px rgba(0, 0, 0, 0.1)',
      animation: 'slideInRight 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: '#111827',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          Assistant
          {isStreaming && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#3B82F6',
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
                animation: 'pulse-dot 1.5s ease-in-out infinite',
              }}
            />
          )}
        </h3>
        <button
          onClick={onToggle}
          style={{
            padding: '4px 8px',
            backgroundColor: '#F3F4F6',
            color: '#374151',
            border: '1px solid #D1D5DB',
            borderRadius: 4,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      {/* Thread selector */}
      <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
        <ThreadSelector 
          documentId={documentId} 
          onNewThread={handleNewThread}
        />
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FEF2F2',
          borderBottom: '1px solid #FECACA',
          color: '#DC2626',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#DC2626',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 0',
        backgroundColor: '#FAFAFA',
      }}>
        {messages.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: '#6B7280',
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>💬</div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600 }}>
              Start a conversation
            </h4>
            <p style={{ margin: '0 0 24px 0', fontSize: 14 }}>
              Ask questions about this document or get help understanding the content.
            </p>
            
            {/* Suggested prompts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInputValue(prompt)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #D1D5DB',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#374151',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              // Skip empty assistant messages - they'll be shown as "AI is thinking..."
              if (message.role === 'assistant' && !message.content) {
                return null
              }
              
              const isNewMessage = !renderedMessageIdsRef.current.has(message.id)
              const wasNavigating = prevTargetMessageIdRef.current !== null
              
              // Determine if message should have enter animation
              // Don't animate if: already rendered OR navigating to a message when it was added
              let shouldAnimate = false
              if (isNewMessage) {
                renderedMessageIdsRef.current.add(message.id)
                // Only animate if not navigating
                shouldAnimate = !wasNavigating
              }
              
              return (
                <div 
                  key={message.id} 
                  className={shouldAnimate ? "message-enter" : ""}
                  ref={(el) => {
                    if (el) {
                      messageRefs.current.set(message.id, el)
                    } else {
                      messageRefs.current.delete(message.id)
                    }
                  }}
                >
                  <ChatMessage message={message} />
                </div>
              )
            })}
            
            {/* Loading indicator - only show when streaming and last message is empty assistant */}
            {isStreaming && messages.length > 0 && (() => {
              const lastMessage = messages[messages.length - 1]
              return lastMessage.role === 'assistant' && !lastMessage.content
            })() && (
              <div style={{
                padding: '12px 16px',
                fontSize: 14,
                textAlign: 'left',
              }} className="thinking-text">
                AI is thinking...
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #E5E7EB',
        backgroundColor: 'white',
      }}>
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSendMessage}
          placeholder="Ask a question about this document..."
          disabled={isStreaming}
          isStreaming={isStreaming}
          contextItems={contextItems || []}
          currentPage={currentPage || 1}
          selectedLevel={selectedLevel}
          onContextChange={handleContextChange}
        />
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .message-enter {
          animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes highlight {
          0% {
            background-color: #FEF3C7;
          }
          100% {
            background-color: transparent;
          }
        }
        
        .thinking-text {
          background: linear-gradient(
            90deg,
            #6B7280 0%,
            #6B7280 35%,
            #9CA3AF 40%,
            #FFFFFF 50%,
            #9CA3AF 60%,
            #6B7280 65%,
            #6B7280 100%
          );
          background-size: 250% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        
        @keyframes shimmer {
          0% {
            background-position: 150% center;
          }
          100% {
            background-position: -150% center;
          }
        }
        
        @keyframes pulse-dot {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8);
          }
        }
      `}</style>
    </div>
  )
}
