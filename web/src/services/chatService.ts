import { supabase } from '../lib/supabase'
import type { ContextType } from '../types/document'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export interface ChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pageContext?: number
  contextType?: ContextType
  chapterId?: string
  createdAt: string
}

export interface ThreadWithMessages extends ChatThread {
  messages: ChatMessage[]
}

export interface CreateThreadRequest {
  title?: string
}

export interface CreateMessageRequest {
  content: string
  pageContext?: number
  contextType?: ContextType
  chapterId?: string
}

export interface StreamEvent {
  type: 'chunk' | 'complete' | 'error'
  content?: string
  messageId?: string
  error?: string
}

export interface PageQuestion {
  id: string
  threadId: string
  threadTitle: string
  content: string
  answer?: string | null  // First assistant response to this question
  createdAt: string
  userId?: string  // ID of the user who asked the question
  isOwn?: boolean  // Whether this question belongs to the current user
  canOpenThread?: boolean  // Whether the thread can be opened (only for own questions)
}

export interface PageQuestionsData {
  pageNumber: number
  totalQuestions: number
  questions: PageQuestion[]
}

export interface AllDocumentQuestionsResponse {
  documentId: string
  lastModified: string
  pages: PageQuestionsData[]
}

export interface DocumentQuestionsMetadataResponse {
  documentId: string
  lastModified: string
  totalQuestions: number
  pagesWithQuestions: number[]
}

class ChatService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.access_token) {
      throw new Error('Authentication required. Please log in again.')
    }
    const token = session.access_token
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  async createThread(documentId: string, request: CreateThreadRequest = {}): Promise<ChatThread> {
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/chat/threads`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      let errorMessage = `Failed to create thread: ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.detail) {
          errorMessage = errorData.detail
        }
      } catch {
        // If response is not JSON, use status text
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  async getPageQuestions(documentId: string, pageNumber: number): Promise<PageQuestionsData> {
    const response = await fetch(
      `${API_BASE_URL}/api/documents/${documentId}/pages/${pageNumber}/questions`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get page questions: ${response.statusText}`)
    }

    return response.json()
  }

  async getAllDocumentQuestions(documentId: string): Promise<AllDocumentQuestionsResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/documents/${documentId}/questions/all`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get all document questions: ${response.statusText}`)
    }

    return response.json()
  }

  async getDocumentQuestionsMetadata(documentId: string): Promise<DocumentQuestionsMetadataResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/documents/${documentId}/questions/metadata`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get document questions metadata: ${response.statusText}`)
    }

    return response.json()
  }

  async listThreads(documentId: string, since?: string): Promise<ChatThread[]> {
    const url = new URL(`${API_BASE_URL}/api/documents/${documentId}/chat/threads`)
    if (since) {
      url.searchParams.set('since', since)
    }
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to list threads: ${response.statusText}`)
    }

    return response.json()
  }

  async getThreadMessages(threadId: string, since?: string): Promise<ThreadWithMessages> {
    const url = new URL(`${API_BASE_URL}/api/chat/threads/${threadId}/messages`)
    if (since) {
      url.searchParams.set('since', since)
    }
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get thread messages: ${response.statusText}`)
    }

    return response.json()
  }

  async sendMessage(
    threadId: string, 
    request: CreateMessageRequest,
    onChunk?: (content: string) => void,
    onComplete?: (messageId: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/threads/${threadId}/messages`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      // Try to get error message from response body
      let errorMessage = `Failed to send message: ${response.statusText}`
      let errorData: any = null
      let limitError: any = null
      
      try {
        errorData = await response.json()
        console.log('Error response data:', errorData)
        
        // Check if it's a limit exceeded error
        if (errorData.error_type === 'limit_exceeded') {
          // Return structured error for limit exceeded
          limitError = {
            error_type: 'limit_exceeded',
            limit_type: errorData.limit_type,
            limit_value: errorData.limit_value,
            current_usage: errorData.current_usage,
            limit_period: errorData.limit_period,
            message: errorData.message || errorMessage
          }
          
          console.log('Limit exceeded error detected:', limitError)
          
          // Call error callback with structured error
          if (onError) {
            onError(JSON.stringify(limitError))
          }
          
          // Throw error with the limitError object attached
          const error = new Error(limitError.message)
          ;(error as any).limitError = limitError
          throw error
        }
        
        // Handle other error types
        if (errorData.detail) {
          errorMessage = errorData.detail
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch (parseError) {
        // If parseError is our limit error, rethrow it
        if (parseError instanceof Error && (parseError as any).limitError) {
          throw parseError
        }
        // If response is not JSON, use status text
        console.log('Failed to parse error response:', parseError)
      }
      
      // Call error callback if provided (for non-limit errors)
      if (onError && !limitError) {
        onError(errorMessage)
      }
      
      // Throw error - if it's not already thrown above
      const error = new Error(errorMessage)
      if (limitError) {
        (error as any).limitError = limitError
      }
      throw error
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamEvent
              
              switch (data.type) {
                case 'chunk':
                  if (data.content && onChunk) {
                    onChunk(data.content)
                  }
                  break
                case 'complete':
                  if (data.messageId && onComplete) {
                    onComplete(data.messageId)
                  }
                  break
                case 'error':
                  if (data.error && onError) {
                    onError(data.error)
                  }
                  break
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // Helper method to create a new thread and send the first message
  async startNewConversation(
    documentId: string,
    firstMessage: string,
    pageContext?: number,
    contextType?: ContextType,
    chapterId?: string,
    onChunk?: (content: string) => void,
    onComplete?: (messageId: string) => void,
    onError?: (error: string) => void
  ): Promise<ChatThread> {
    try {
      // Create thread
      const thread = await this.createThread(documentId, {
        title: firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage
      })

      // Send first message
      await this.sendMessage(
        thread.id,
        { 
          content: firstMessage, 
          pageContext,
          contextType,
          chapterId
        },
        onChunk,
        onComplete,
        onError
      )

      return thread
    } catch (error: any) {
      console.log('startNewConversation caught error:', error)
      console.log('Error limitError:', error?.limitError)
      
      // If error callback is provided, call it, but also rethrow the error
      if (onError && error instanceof Error) {
        // Check if error has limitError attached
        if ((error as any).limitError) {
          console.log('Passing limitError to callback:', (error as any).limitError)
          onError(JSON.stringify((error as any).limitError))
        } else {
          onError(error.message)
        }
      }
      
      // Make sure limitError is preserved when rethrowing
      if ((error as any).limitError) {
        const rethrowError = new Error(error.message || 'Failed to start conversation')
        ;(rethrowError as any).limitError = (error as any).limitError
        throw rethrowError
      }
      
      throw error
    }
  }
}

export const chatService = new ChatService()
