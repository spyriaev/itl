import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatMessageProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    pageContext?: number
    createdAt: string
  }
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 16,
      padding: '0 16px',
    }}>
      {/* Message bubble */}
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: 18,
        backgroundColor: isUser ? '#3B82F6' : '#F3F4F6',
        color: isUser ? 'white' : '#111827',
        fontSize: 14,
        lineHeight: 1.5,
        wordWrap: 'break-word',
        position: 'relative',
      }}>
        {isAssistant ? (
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.5 }}>{children}</p>,
              ul: ({ children }) => <ul style={{ margin: '0 0 8px 0', paddingLeft: 20 }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0 0 8px 0', paddingLeft: 20 }}>{children}</ol>,
              li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
              code: ({ children }) => (
                <code style={{
                  backgroundColor: '#E5E7EB',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: 'monospace',
                }}>
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre style={{
                  backgroundColor: '#E5E7EB',
                  padding: 12,
                  borderRadius: 8,
                  overflow: 'auto',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  margin: '8px 0',
                }}>
                  {children}
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote style={{
                  borderLeft: '4px solid #D1D5DB',
                  paddingLeft: 12,
                  margin: '8px 0',
                  fontStyle: 'italic',
                  color: '#6B7280',
                }}>
                  {children}
                </blockquote>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </div>
        )}
      </div>

      {/* Message metadata */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        fontSize: 12,
        color: '#6B7280',
      }}>
        <span>{formatTime(message.createdAt)}</span>
        {message.pageContext && (
          <>
            <span>•</span>
            <span>Page {message.pageContext}</span>
          </>
        )}
      </div>
    </div>
  )
}
