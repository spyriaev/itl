import { supabase } from '../lib/supabase'

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
}

export interface StreamEvent {
  type: 'chunk' | 'complete' | 'error'
  content?: string
  messageId?: string
  error?: string
}

class ChatService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
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
      throw new Error(`Failed to create thread: ${response.statusText}`)
    }

    return response.json()
  }

  async listThreads(documentId: string): Promise<ChatThread[]> {
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/chat/threads`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to list threads: ${response.statusText}`)
    }

    return response.json()
  }

  async getThreadMessages(threadId: string): Promise<ThreadWithMessages> {
    const response = await fetch(`${API_BASE_URL}/api/chat/threads/${threadId}/messages`, {
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
      throw new Error(`Failed to send message: ${response.statusText}`)
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
    onChunk?: (content: string) => void,
    onComplete?: (messageId: string) => void,
    onError?: (error: string) => void
  ): Promise<ChatThread> {
    // Create thread
    const thread = await this.createThread(documentId, {
      title: firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage
    })

    // Send first message
    await this.sendMessage(
      thread.id,
      { content: firstMessage, pageContext },
      onChunk,
      onComplete,
      onError
    )

    return thread
  }
}

export const chatService = new ChatService()
