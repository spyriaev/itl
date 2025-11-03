import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface FloatingAnswerProps {
  selectedText: string
  question: string
  answer: string
  isStreaming: boolean
  onClose: () => void
  position?: { top: number; left: number }
}

export function FloatingAnswer({
  selectedText,
  question,
  answer,
  isStreaming,
  onClose,
  position
}: FloatingAnswerProps) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [answer, isStreaming])

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
            backgroundColor: '#FAFAFA',
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

