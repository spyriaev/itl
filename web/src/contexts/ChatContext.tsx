import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { chatService, ChatThread, ChatMessage, ThreadWithMessages } from '../services/chatService'

interface ChatContextType {
  // State
  activeThread: ChatThread | null
  messages: ChatMessage[]
  threads: ChatThread[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  
  // Actions
  loadThreads: (documentId: string) => Promise<void>
  selectThread: (threadId: string) => Promise<void>
  createNewThread: (documentId: string, title?: string) => Promise<ChatThread>
  sendMessage: (content: string, pageContext?: number) => Promise<void>
  startNewConversation: (documentId: string, firstMessage: string, pageContext?: number) => Promise<void>
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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadThreads = useCallback(async (documentId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const threadList = await chatService.listThreads(documentId)
      setThreads(threadList)
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
      const threadWithMessages = await chatService.getThreadMessages(threadId)
      setActiveThread(threadWithMessages)
      setMessages(threadWithMessages.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createNewThread = useCallback(async (documentId: string, title?: string): Promise<ChatThread> => {
    try {
      setError(null)
      const newThread = await chatService.createThread(documentId, { title })
      setThreads(prev => [newThread, ...prev])
      setActiveThread(newThread)
      setMessages([])
      return newThread
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create thread'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const sendMessage = useCallback(async (content: string, pageContext?: number) => {
    if (!activeThread) {
      setError('No active thread')
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
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])

      // Stream the response
      await chatService.sendMessage(
        activeThread.id,
        { content, pageContext },
        (chunk) => {
          // Update the streaming assistant message
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ))
        },
        (messageId) => {
          // Replace temp message with real message
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, id: messageId }
              : msg
          ))
          setIsStreaming(false)
        },
        (error) => {
          setError(error)
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
    pageContext?: number
  ) => {
    try {
      setIsStreaming(true)
      setError(null)

      // Create thread and send first message
      const newThread = await chatService.startNewConversation(
        documentId,
        firstMessage,
        pageContext,
        (chunk) => {
          // Handle streaming for new conversation
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              return prev.map(msg => 
                msg.id === lastMessage.id 
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            }
            return prev
          })
        },
        (messageId) => {
          setIsStreaming(false)
        },
        (error) => {
          setError(error)
          setIsStreaming(false)
        }
      )

      setActiveThread(newThread)
      setThreads(prev => [newThread, ...prev])
      
      // Add messages to state
      const userMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: firstMessage,
        pageContext,
        createdAt: new Date().toISOString()
      }
      
      const assistantMessage: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        pageContext,
        createdAt: new Date().toISOString()
      }
      
      setMessages([userMessage, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
      setIsStreaming(false)
    }
  }, [])

  const contextValue: ChatContextType = {
    activeThread,
    messages,
    threads,
    isLoading,
    isStreaming,
    error,
    loadThreads,
    selectThread,
    createNewThread,
    sendMessage,
    startNewConversation,
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
