import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LimitErrorData {
  error_type: string
  limit_type: string
  limit_value: number
  current_usage?: number
  limit_period: string
  message: string
}

interface FloatingAnswerProps {
  selectedText: string
  question: string
  answer: string
  isStreaming: boolean
  onClose: () => void
  onOpenChat?: () => void
  position?: { top: number; left: number }
  limitError?: LimitErrorData
}

export function FloatingAnswer({
  selectedText,
  question,
  answer,
  isStreaming,
  onClose,
  onOpenChat,
  position,
  limitError
}: FloatingAnswerProps) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const safeAreaInsets = {
    top: 'env(safe-area-inset-top, 0px)',
    right: 'env(safe-area-inset-right, 0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 'env(safe-area-inset-left, 0px)',
  } as const

  // Auto-scroll to answer when it appears
  useEffect(() => {
    if (contentRef.current && containerRef.current && answer && !isStreaming) {
      // Scroll to the answer section
      const container = containerRef.current
      const answerElement = contentRef.current
      const answerTop = answerElement.offsetTop - container.offsetTop
      
      container.scrollTo({
        top: answerTop - 20, // 20px offset from top
        behavior: 'smooth'
      })
    }
  }, [answer, isStreaming])

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (containerRef.current && isStreaming && answer) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [answer, isStreaming])

  // Parse limit error to extract details
  const parseLimitError = (errorText: string) => {
    // Try to match "Maximum: 25 questions per month"
    const maxMatch = errorText.match(/Maximum:\s*(\d+)\s+(questions?|tokens?|files?|storage)/i)
    
    // Try to match "25 questions per month"
    const limitMatch = errorText.match(/(\d+)\s+(questions?|tokens?|files?|storage)\s+per\s+(month|day)/i)
    
    // Try to match "Question limit exceeded"
    const typeMatch = errorText.match(/(Question|Token|File|Storage|Storage)\s+limit/i)
    
    // Extract limit number
    const limit = maxMatch 
      ? parseInt(maxMatch[1]) 
      : limitMatch 
        ? parseInt(limitMatch[1]) 
        : null
    
    // Extract type
    const type = maxMatch 
      ? maxMatch[2].toLowerCase().replace(/s$/, '') // Remove plural 's'
      : limitMatch 
        ? limitMatch[2].toLowerCase().replace(/s$/, '')
        : typeMatch 
          ? typeMatch[1].toLowerCase()
          : null
    
    return {
      limit,
      type,
      fullText: errorText
    }
  }

  // Check if answer is an error message (limit exceeded, etc.)
  // Priority: use limitError prop if available, otherwise check answer text
  const isError = !isStreaming && (limitError || (answer && (
    answer.includes('limit exceeded') ||
    answer.includes('Limit exceeded') ||
    answer.includes('Maximum:') ||
    answer.includes('Failed to') ||
    answer.includes('Error') ||
    answer.includes('Authentication required')
  )))
  
  // Use limitError data if available, otherwise parse from answer
  const errorInfo: {
    limit: number | null
    type: string | null
    current_usage?: number
    period?: string
    fullText: string
  } | null = limitError && limitError.error_type === 'limit_exceeded' ? {
    limit: limitError.limit_value,
    type: limitError.limit_type,
    current_usage: limitError.current_usage,
    period: limitError.limit_period,
    fullText: limitError.message
  } : (isError && !limitError ? parseLimitError(answer) : null)
  
  // Debug logging
  React.useEffect(() => {
    if (limitError) {
      console.log('FloatingAnswer received limitError:', limitError)
      console.log('isError:', isError)
      console.log('errorInfo:', errorInfo)
    }
  }, [limitError, isError, errorInfo])

  // Calculate position - center by default, or use provided position
  const baseContainerStyle: React.CSSProperties = position
    ? {
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%)',
        marginBottom: 16,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }

  const containerStyle: React.CSSProperties = {
    ...baseContainerStyle,
    maxHeight: `calc(100vh - 80px - ${safeAreaInsets.top} - ${safeAreaInsets.bottom})`,
    marginTop: position ? undefined : safeAreaInsets.top,
    marginBottom: position ? undefined : safeAreaInsets.bottom,
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 5000,
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onClose}
      />
      
      {/* Answer Card */}
      <div
        ref={containerRef}
        style={{
          ...containerStyle,
          backgroundColor: 'white',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 5001,
          width: `calc(90% - ${safeAreaInsets.left} - ${safeAreaInsets.right})`,
          maxWidth: `calc(600px - ${safeAreaInsets.left} - ${safeAreaInsets.right})`,
          maxHeight: `calc(100vh - 80px - ${safeAreaInsets.top} - ${safeAreaInsets.bottom})`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUpFadeIn 0.3s ease-out',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: '#D1D5DB #F9FAFB',
        }}
        onClick={(e) => e.stopPropagation()}
        className="floating-answer-content"
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            paddingRight: '48px',
            paddingLeft: '48px',
            paddingTop: '48px',
            borderBottom: '1px solid #E5E7EB',
            position: 'relative',
          }}
        >
          {/* Logo - top left */}
          <div
            className={isStreaming ? 'logo-thinking' : ''}
            style={{
              position: 'absolute',
              top: 16,
              left: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M5.75 21.25H15.45C17.1302 21.25 17.9702 21.25 18.612 20.923C19.1765 20.6354 19.6354 20.1765 19.923 19.612C20.25 18.9702 20.25 18.1302 20.25 16.45V10.9882C20.25 10.2545 20.25 9.88757 20.1671 9.5423C20.0936 9.2362 19.9724 8.94356 19.8079 8.67515C19.6224 8.3724 19.363 8.11297 18.8441 7.59411L15.4059 4.15589C14.887 3.63703 14.6276 3.37761 14.3249 3.19208C14.0564 3.02759 13.7638 2.90638 13.4577 2.83289C13.1124 2.75 12.7455 2.75 12.0118 2.75H9.875H9.25C8.78558 2.75 8.55337 2.75 8.35842 2.77567C7.01222 2.9529 5.9529 4.01222 5.77567 5.35842C5.75 5.55337 5.75 5.78558 5.75 6.25" stroke={isStreaming ? "#2563EB" : "#9CA3AF"} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M13.75 2.75V4.45C13.75 6.13016 13.75 6.97024 14.077 7.61197C14.3646 8.17646 14.8235 8.6354 15.388 8.92302C16.0298 9.25 16.8698 9.25 18.55 9.25H20.25" stroke={isStreaming ? "#2563EB" : "#9CA3AF"} strokeWidth="1.5" />
                <path d="M9.33687 15.1876L8.67209 17.2136C8.53833 17.6213 7.96167 17.6213 7.82791 17.2136L7.16313 15.1876C7.03098 14.7849 6.71511 14.469 6.31236 14.3369L4.28637 13.6721C3.87872 13.5383 3.87872 12.9617 4.28637 12.8279L6.31236 12.1631C6.71511 12.031 7.03098 11.7151 7.16313 11.3124L7.82791 9.28637C7.96167 8.87872 8.53833 8.87872 8.67209 9.28637L9.33687 11.3124C9.46902 11.7151 9.78489 12.031 10.1876 12.1631L12.2136 12.8279C12.6213 12.9617 12.6213 13.5383 12.2136 13.6721L10.1876 14.3369C9.78489 14.469 9.46902 14.7849 9.33687 15.1876Z" fill={isStreaming ? "#2563EB" : "#9CA3AF"} />
              </svg>
            </div>
            <span
              className={isStreaming ? 'logo-text-thinking' : ''}
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontWeight: 500,
              }}
            >
              Innesi AI Reader
            </span>
          </div>
          
          {/* Close button - top right */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
              e.currentTarget.style.color = '#111827'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#6B7280'
            }}
            aria-label={t('textSelection.close')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          
          {/* Question */}
          <div
            style={{
              fontSize: 14,
              color: '#111827',
              fontWeight: 600,
              backgroundColor: '#EFF6FF',
              padding: '14px 18px',
              borderRadius: 8,
              borderLeft: '4px solid #2563EB',
              lineHeight: 1.5,
              marginBottom: 0,
              wordBreak: 'break-word',
            }}
          >
            {question}
          </div>
        </div>

        {/* Content - Answer */}
        <div
          ref={contentRef}
          style={{
            padding: '20px',
            fontSize: 14,
            lineHeight: 1.5,
            color: '#374151',
            backgroundColor: isError ? '#FEF2F2' : '#FAFAFA',
          }}
        >
          {isStreaming && !answer ? (
            <div
              style={{
                padding: '12px 16px',
                fontSize: 14,
                textAlign: 'left',
              }}
              className="thinking-text"
            >
              {t("chatPanel.aiThinking")}
            </div>
          ) : isError ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Error Icon and Title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '16px',
                  backgroundColor: '#FEE2E2',
                  borderRadius: 8,
                  border: '1px solid #FECACA',
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <path
                    d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="#DC2626"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#DC2626',
                      marginBottom: 8,
                    }}
                  >
                    {errorInfo?.type === 'question' 
                      ? t('textSelection.limitExceeded', { defaultValue: 'Question Limit Exceeded' })
                      : t('textSelection.limitExceeded', { defaultValue: 'Limit Exceeded' })
                    }
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#991B1B',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {answer}
                  </div>
                  {errorInfo && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '12px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: 6,
                        fontSize: 13,
                        color: '#7F1D1D',
                        border: '1px solid #FECACA',
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong>{t('textSelection.currentLimit', { defaultValue: 'Current limit' })}:</strong>{' '}
                        <strong style={{ color: '#DC2626' }}>{errorInfo.limit}</strong>{' '}
                        {errorInfo.type === 'question' 
                          ? t('textSelection.questionsPerMonth', { defaultValue: 'questions per month' })
                          : errorInfo.type === 'token'
                          ? t('textSelection.tokensPerMonth', { defaultValue: 'tokens per month' })
                          : errorInfo.type === 'file'
                          ? t('textSelection.filesPerMonth', { defaultValue: 'files per month' })
                          : errorInfo.type === 'storage'
                          ? t('textSelection.storageLimit', { defaultValue: 'MB of storage' })
                          : ''
                        }
                      </div>
                      {errorInfo && errorInfo.current_usage !== undefined && errorInfo.limit !== null && (
                        <div style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>
                          {t('textSelection.currentUsage', { defaultValue: 'Current usage' })}: <strong>{errorInfo.current_usage}</strong> / {errorInfo.limit}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  wordBreak: 'break-word',
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p style={{ margin: '0 0 12px 0', lineHeight: 1.6 }}>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ margin: '0 0 12px 0', paddingLeft: 20, lineHeight: 1.6 }}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ margin: '0 0 12px 0', paddingLeft: 20, lineHeight: 1.6 }}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li style={{ marginBottom: 6 }}>{children}</li>,
                    code: ({ children }) => (
                      <code
                        style={{
                          backgroundColor: '#E5E7EB',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 13,
                          fontFamily: 'monospace',
                        }}
                      >
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre
                        style={{
                          backgroundColor: '#E5E7EB',
                          padding: 12,
                          borderRadius: 8,
                          overflow: 'auto',
                          fontSize: 13,
                          fontFamily: 'monospace',
                          margin: '12px 0',
                        }}
                      >
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote
                        style={{
                          borderLeft: '4px solid #D1D5DB',
                          paddingLeft: 12,
                          margin: '12px 0',
                          fontStyle: 'italic',
                          color: '#6B7280',
                        }}
                      >
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        style={{ color: '#2563EB', textDecoration: 'underline' }}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: 13,
                          }}
                        >
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th
                        style={{
                          border: '1px solid #D1D5DB',
                          padding: '8px 10px',
                          backgroundColor: '#F3F4F6',
                          textAlign: 'left',
                        }}
                      >
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td
                        style={{
                          border: '1px solid #E5E7EB',
                          padding: '8px 10px',
                        }}
                      >
                        {children}
                      </td>
                    ),
                  }}
                >
                  {answer || ''}
                </ReactMarkdown>
                {isStreaming && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 16,
                      backgroundColor: '#2563EB',
                      marginLeft: 2,
                      animation: 'blink 1s infinite',
                      verticalAlign: 'baseline',
                    }}
                  />
                )}
                {!isStreaming && answer && onOpenChat && (
                  <>
                    {' '}
                    <span
                      onClick={onOpenChat}
                      style={{
                        color: '#2563EB',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginLeft: 4,
                        fontSize: 14,
                        fontWeight: 500,
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#1D4ED8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#2563EB'
                      }}
                    >
                      Перейти в чат
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ flexShrink: 0 }}
                      >
                        <path
                          d="M6 12L10 8L6 4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -40%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }

        /* Custom scrollbar styling for webkit browsers */
        .floating-answer-content::-webkit-scrollbar {
          width: 8px;
        }

        .floating-answer-content::-webkit-scrollbar-track {
          background: #F9FAFB;
          border-radius: 4px;
        }

        .floating-answer-content::-webkit-scrollbar-thumb {
          background: #D1D5DB;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .floating-answer-content::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
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


        .logo-text-thinking {
          background: linear-gradient(
            90deg,
            #2563EB 0%,
            #2563EB 35%,
            #3B82F6 40%,
            #60A5FA 50%,
            #3B82F6 60%,
            #2563EB 65%,
            #2563EB 100%
          );
          background-size: 250% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerBlue 3s linear infinite;
        }

        @keyframes shimmerBlue {
          0% {
            background-position: 150% center;
          }
          100% {
            background-position: -150% center;
          }
        }
      `}</style>
    </>
  )
}

