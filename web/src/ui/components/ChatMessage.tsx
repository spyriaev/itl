import React from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DocumentStructureItem, ContextType } from '../../types/document'

interface ChatMessageProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    pageContext?: number
    contextType?: ContextType
    chapterId?: string
    createdAt: string
  }
  documentStructure?: DocumentStructureItem[]
}

export function ChatMessage({ message, documentStructure }: ChatMessageProps) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isEmptyAssistant = isAssistant && !message.content

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // Find chapter info by ID in document structure
  const findChapterById = (items: DocumentStructureItem[], id: string): DocumentStructureItem | null => {
    for (const item of items) {
      if (item.id === id) {
        return item
      }
      if (item.children && item.children.length > 0) {
        const found = findChapterById(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  const chapterInfo = message.chapterId && documentStructure
    ? findChapterById(documentStructure, message.chapterId)
    : null

  const isChapterContext = message.contextType === 'chapter'
  const shouldShowChapterInfo = isChapterContext && chapterInfo

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
        {isEmptyAssistant ? (
          // Show loading indicator for empty assistant messages
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#6B7280',
          }}>
            <div style={{
              display: 'flex',
              gap: 3,
            }}>
              <div style={{
                width: 6,
                height: 6,
                backgroundColor: '#6B7280',
                borderRadius: '50%',
                animation: 'pulse 1.4s ease-in-out infinite both',
              }} />
              <div style={{
                width: 6,
                height: 6,
                backgroundColor: '#6B7280',
                borderRadius: '50%',
                animation: 'pulse 1.4s ease-in-out infinite both',
                animationDelay: '0.2s',
              }} />
              <div style={{
                width: 6,
                height: 6,
                backgroundColor: '#6B7280',
                borderRadius: '50%',
                animation: 'pulse 1.4s ease-in-out infinite both',
                animationDelay: '0.4s',
              }} />
            </div>
          </div>
        ) : isAssistant ? (
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
        maxWidth: '80%',
      }}>
        <span>{formatTime(message.createdAt)}</span>
        {shouldShowChapterInfo && chapterInfo ? (
          <>
            <span>•</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {chapterInfo.title
                .replace(/[☑☒☐✓✗×◊◆►▸▹►▲▼]/g, '')
                .replace(/[^\p{L}\p{N}\s.,;:!?()[\]{}""''-]/gu, '')
                .trim()}
            </span>
          </>
        ) : message.pageContext ? (
          <>
            <span>•</span>
            <span>{t("chatMessage.page")} {message.pageContext}</span>
          </>
        ) : null}
      </div>

      {/* CSS for loading animation */}
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
      `}</style>
    </div>
  )
}
