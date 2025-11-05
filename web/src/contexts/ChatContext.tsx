import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { chatService, ChatThread, ChatMessage, ThreadWithMessages } from '../services/chatService'
import {
  getCachedThreads, cacheThreads, getCachedMessages, cacheMessages, appendMessages,
  initQuestionsCache
} from '../services/questionsCache'
import { isOnline } from '../hooks/useNetworkStatus'

interface ChatContextType {
  // State
  activeThread: ChatThread | null
  messages: ChatMessage[]
  threads: ChatThread[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  targetMessageId: string | null
  
  // Actions
  loadThreads: (documentId: string) => Promise<void>
  selectThread: (threadId: string) => Promise<void>
  createNewThread: (documentId: string, title?: string) => Promise<ChatThread>
  sendMessage: (content: string, pageContext?: number, contextType?: string, chapterId?: string) => Promise<void>
  startNewConversation: (documentId: string, firstMessage: string, pageContext?: number, contextType?: string, chapterId?: string) => Promise<void>
  navigateToMessage: (threadId: string, messageId: string) => Promise<void>
  clearError: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

interface ChatProviderProps {
  children: React.ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null)

  // Initialize cache on mount
  useEffect(() => {
    initQuestionsCache()
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadThreads = useCallback(async (documentId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Try to load from cache first
      const cachedThreads = await getCachedThreads(documentId)
      if (cachedThreads.length > 0) {
        setThreads(cachedThreads)
      }
      
      // Then sync with server
      try {
        const threadList = await chatService.listThreads(documentId)
        setThreads(threadList)
        // Cache the threads (convert ChatThread[] to CachedThread[] by adding documentId)
        const threadsToCache = threadList.map(thread => ({ ...thread, documentId }))
        await cacheThreads(documentId, threadsToCache)
      } catch (err) {
        // If offline, use cached threads
        if (cachedThreads.length > 0) {
          console.warn('Failed to sync threads from server, using cache:', err)
        } else {
          throw err
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const selectThread = useCallback(async (threadId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Try to load from cache first
      const cachedMessages = await getCachedMessages(threadId)
      if (cachedMessages.length > 0) {
        // Find the thread in the threads list
        const thread = threads.find(t => t.id === threadId)
        if (thread) {
          setActiveThread(thread)
          setMessages(cachedMessages)
        }
      }
      
      // Then sync with server
      try {
        const threadWithMessages = await chatService.getThreadMessages(threadId)
        setActiveThread(threadWithMessages)
        setMessages(threadWithMessages.messages)
        // Cache the messages
        await cacheMessages(threadId, threadWithMessages.messages)
      } catch (err) {
        // If offline, use cached messages
        if (cachedMessages.length > 0) {
          console.warn('Failed to sync messages from server, using cache:', err)
        } else {
          throw err
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setIsLoading(false)
    }
  }, [threads])

  const createNewThread = useCallback(async (documentId: string, title?: string): Promise<ChatThread> => {
    // Check if offline
    if (!isOnline()) {
      const errorMessage = 'Нет подключения к интернету'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
    
    try {
      setError(null)
      const newThread = await chatService.createThread(documentId, { title })
      const updatedThreads = [newThread, ...threads]
      setThreads(updatedThreads)
      setActiveThread(newThread)
      setMessages([])
      // Cache the new thread (convert ChatThread[] to CachedThread[] by adding documentId)
      const cachedThreads = updatedThreads.map(thread => ({ ...thread, documentId }))
      await cacheThreads(documentId, cachedThreads)
      return newThread
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create thread'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [threads])

  const sendMessage = useCallback(async (content: string, pageContext?: number, contextType?: string, chapterId?: string) => {
    if (!activeThread) {
      setError('No active thread')
      return
    }

    // Check if offline
    if (!isOnline()) {
      setError('Нет подключения к интернету')
      return
    }

    try {
      setIsStreaming(true)
      setError(null)

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        pageContext,
        contextType,
        chapterId,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, userMessage])

      // Add placeholder for assistant message
      const assistantMessageId = `temp-assistant-${Date.now()}`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        pageContext,
        contextType,
        chapterId,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])

      // Stream the response
      await chatService.sendMessage(
        activeThread.id,
        { content, pageContext, contextType, chapterId },
        (chunk) => {
          // Update the streaming assistant message
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ))
        },
        (messageId) => {
          // Replace temp message with real message - preserve contextType and chapterId
          setMessages(prev => {
            const updated = prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, id: messageId, contextType: msg.contextType, chapterId: msg.chapterId, pageContext: msg.pageContext }
                : msg
            )
            // Update cache with new messages
            if (activeThread) {
              cacheMessages(activeThread.id, updated).catch(err => 
                console.error('Failed to cache messages:', err)
              )
            }
            return updated
          })
          setIsStreaming(false)
        },
        (error) => {
          // Check if it's a limit exceeded error
          try {
            const errorData = JSON.parse(error)
            if (errorData.error_type === 'limit_exceeded') {
              setError(errorData.message || error)
            } else {
              setError(error)
            }
          } catch {
            // Not a JSON error, use as is
            setError(error)
          }
          setIsStreaming(false)
          // Remove the failed assistant message
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      setIsStreaming(false)
    }
  }, [activeThread])

  const startNewConversation = useCallback(async (
    documentId: string, 
    firstMessage: string, 
    pageContext?: number,
    contextType?: string,
    chapterId?: string
  ) => {
    // Check if offline
    if (!isOnline()) {
      setError('Нет подключения к интернету')
      return
    }
    
    try {
      setIsStreaming(true)
      setError(null)

      // Add messages to state FIRST before streaming starts
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: firstMessage,
        pageContext,
        contextType,
        chapterId,
        createdAt: new Date().toISOString()
      }
      
      const assistantMessageId = `temp-assistant-${Date.now()}`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        pageContext,
        contextType,
        chapterId,
        createdAt: new Date().toISOString()
      }
      
      setMessages([userMessage, assistantMessage])

      // Create thread first (synchronously)
      let newThread: ChatThread
      const threadIdRef = { current: null as string | null }
      
      try {
        // Create thread first
        newThread = await chatService.createThread(documentId, {
          title: firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage
        })
        
        // Store threadId in ref immediately
        threadIdRef.current = newThread.id
        
        // Send first message
        await chatService.sendMessage(
          newThread.id,
          { 
            content: firstMessage, 
            pageContext,
            contextType,
            chapterId
          },
          (chunk) => {
            // Handle streaming for new conversation
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: msg.content + chunk }
                : msg
            ))
          },
          (messageId) => {
            // Replace temp message with real message - preserve contextType and chapterId
            setMessages(prev => {
              const updated = prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, id: messageId, contextType: msg.contextType, chapterId: msg.chapterId, pageContext: msg.pageContext }
                  : msg
              )
              // Update cache with new messages
              if (threadIdRef.current) {
                cacheMessages(threadIdRef.current, updated).catch(err => 
                  console.error('Failed to cache messages:', err)
                )
              }
              return updated
            })
            setIsStreaming(false)
          },
          (error) => {
            // Check if it's a limit exceeded error
            try {
              const errorData = JSON.parse(error)
              if (errorData.error_type === 'limit_exceeded') {
                setError(errorData.message || error)
              } else {
                setError(error)
              }
            } catch {
              // Not a JSON error, use as is
              setError(error)
            }
            setIsStreaming(false)
            // Remove the failed assistant message
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
          }
        )
      } catch (err: any) {
        console.log('startNewConversation caught error:', err)
        console.log('Error limitError:', err?.limitError)
        
        // Check if it's a limit exceeded error
        if (err?.limitError) {
          setError(err.limitError.message || err.message)
          setIsStreaming(false)
          // Re-throw to let PdfViewer handle it
          throw err
        }
        
        throw err
      }

      setActiveThread(newThread)
      setThreads(prev => {
        const updatedThreads = [newThread, ...prev]
        // Cache the new thread (convert ChatThread[] to CachedThread[] by adding documentId)
        const cachedThreads = updatedThreads.map(thread => ({ ...thread, documentId }))
        cacheThreads(documentId, cachedThreads).catch(err => 
          console.error('Failed to cache threads:', err)
        )
        return updatedThreads
      })
    } catch (err: any) {
      console.log('startNewConversation catch in ChatContext:', err)
      console.log('Error limitError:', err?.limitError)
      
      // If error has limitError, preserve it by rethrowing
      if (err?.limitError) {
        setError(err.limitError.message || err.message)
        setIsStreaming(false)
        // Re-throw to let PdfViewer handle it
        throw err
      }
      
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
      setIsStreaming(false)
    }
  }, [])

  const navigateToMessage = useCallback(async (threadId: string, messageId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Try to load from cache first
      const cachedMessages = await getCachedMessages(threadId)
      if (cachedMessages.length > 0) {
        const thread = threads.find(t => t.id === threadId)
        if (thread) {
          setActiveThread(thread)
          setMessages(cachedMessages)
          setTargetMessageId(messageId)
          setTimeout(() => setTargetMessageId(null), 3000)
        }
      }
      
      // Then sync with server
      try {
        const threadWithMessages = await chatService.getThreadMessages(threadId)
        setActiveThread(threadWithMessages)
        setMessages(threadWithMessages.messages)
        setTargetMessageId(messageId)
        
        // Cache the messages
        await cacheMessages(threadId, threadWithMessages.messages)
        
        // Clear target message after a delay to allow scroll animation
        setTimeout(() => {
          setTargetMessageId(null)
        }, 3000)
      } catch (err) {
        // If offline, use cached messages
        if (cachedMessages.length > 0) {
          console.warn('Failed to sync messages from server, using cache:', err)
        } else {
          throw err
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate to message')
    } finally {
      setIsLoading(false)
    }
  }, [threads])

  const contextValue: ChatContextType = {
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
    navigateToMessage,
    clearError,
  }

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
