import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

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
  position?: { top: number; left: number }
  limitError?: LimitErrorData
}

export function FloatingAnswer({
  selectedText,
  question,
  answer,
  isStreaming,
  onClose,
  position,
  limitError
}: FloatingAnswerProps) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [answer, isStreaming])

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
  const errorInfo = limitError && limitError.error_type === 'limit_exceeded' ? {
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


  // Calculate position - center by default, or use provided position
  const containerStyle: React.CSSProperties = position
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
        style={{
          ...containerStyle,
          backgroundColor: 'white',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          zIndex: 5001,
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUpFadeIn 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            paddingRight: '48px',
            paddingTop: '48px',
            borderBottom: '1px solid #E5E7EB',
            position: 'relative',
          }}
        >
          {/* Close button - top right */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 8,
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
              fontSize: 15,
              color: '#111827',
              fontWeight: 600,
              backgroundColor: '#EFF6FF',
              padding: '14px 18px',
              borderRadius: 8,
              borderLeft: '4px solid #2563EB',
              lineHeight: 1.6,
              marginBottom: 0,
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
            overflowY: 'auto',
            flex: 1,
            fontSize: 15,
            lineHeight: 1.7,
            color: '#374151',
            backgroundColor: isError ? '#FEF2F2' : '#FAFAFA',
          }}
        >
          {isStreaming && !answer ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#6B7280',
                fontStyle: 'italic',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              >
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="31.416"
                  strokeDashoffset="31.416"
                  fill="none"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="31.416;0"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
              {t('textSelection.generatingAnswer')}
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
                      {errorInfo.current_usage !== undefined && (
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
            <div
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {answer || ''}
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
            </div>
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
      `}</style>
    </>
  )
}

