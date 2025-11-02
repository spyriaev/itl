import React from 'react'
import { PageQuestionsData } from '../../services/chatService'

interface PageRelatedQuestionsProps {
  questionsData: PageQuestionsData | null
  onQuestionClick: (threadId: string, messageId: string) => void
  isStreaming?: boolean
  currentPageNumber?: number
  streamingQuestionText?: string
}

export function PageRelatedQuestions({ 
  questionsData, 
  onQuestionClick, 
  isStreaming = false,
  currentPageNumber,
  streamingQuestionText
}: PageRelatedQuestionsProps) {
  const { questions } = questionsData || { questions: [] }
  
  // Show component if there are questions OR if streaming for this page
  const shouldShow = (questionsData && questionsData.totalQuestions > 0) || 
                    (isStreaming && currentPageNumber !== undefined)
  
  if (!shouldShow) {
    return null
  }

  // Shimmer component for loading state
  const ShimmerLine = ({ width = '100%' }: { width?: string }) => (
    <div style={{
      width,
      height: 11,
      backgroundColor: '#F3F4F6',
      borderRadius: 2,
      position: 'relative',
      overflow: 'hidden',
      marginTop: 2,
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }} />
    </div>
  )

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      marginTop: 24,
      boxSizing: 'border-box',
      overflow: 'hidden', // Prevent content from overflowing
    }}>
      {/* Horizontal divider with Innesi Reader icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5.75 21.25H15.45C17.1302 21.25 17.9702 21.25 18.612 20.923C19.1765 20.6354 19.6354 20.1765 19.923 19.612C20.25 18.9702 20.25 18.1302 20.25 16.45V10.9882C20.25 10.2545 20.25 9.88757 20.1671 9.5423C20.0936 9.2362 19.9724 8.94356 19.8079 8.67515C19.6224 8.3724 19.363 8.11297 18.8441 7.59411L15.4059 4.15589C14.887 3.63703 14.6276 3.37761 14.3249 3.19208C14.0564 3.02759 13.7638 2.90638 13.4577 2.83289C13.1124 2.75 12.7455 2.75 12.0118 2.75H9.875H9.25C8.78558 2.75 8.55337 2.75 8.35842 2.77567C7.01222 2.9529 5.9529 4.01222 5.77567 5.35842C5.75 5.55337 5.75 5.78558 5.75 6.25" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M13.75 2.75V4.45C13.75 6.13016 13.75 6.97024 14.077 7.61197C14.3646 8.17646 14.8235 8.6354 15.388 8.92302C16.0298 9.25 16.8698 9.25 18.55 9.25H20.25" stroke="#9CA3AF" strokeWidth="1.5" />
            <path d="M9.33687 15.1876L8.67209 17.2136C8.53833 17.6213 7.96167 17.6213 7.82791 17.2136L7.16313 15.1876C7.03098 14.7849 6.71511 14.469 6.31236 14.3369L4.28637 13.6721C3.87872 13.5383 3.87872 12.9617 4.28637 12.8279L6.31236 12.1631C6.71511 12.031 7.03098 11.7151 7.16313 11.3124L7.82791 9.28637C7.96167 8.87872 8.53833 8.87872 8.67209 9.28637L9.33687 11.3124C9.46902 11.7151 9.78489 12.031 10.1876 12.1631L12.2136 12.8279C12.6213 12.9617 12.6213 13.5383 12.2136 13.6721L10.1876 14.3369C9.78489 14.469 9.46902 14.7849 9.33687 15.1876Z" fill="#9CA3AF" />
          </svg>
          <span style={{
            fontSize: 11,
            color: '#9CA3AF',
            fontWeight: 500,
          }}>
            Innesi Reader
          </span>
        </div>
        <div style={{
          flex: 1,
          height: 1,
          backgroundColor: '#E5E7EB',
        }} />
      </div>

      {/* Questions container - styled as footnotes */}
      <div style={{
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        overflow: 'hidden', // Prevent content from overflowing
      }}>
        {/* Streaming indicator - shows when model is thinking/answering */}
        {isStreaming && currentPageNumber !== undefined && (
          <div style={{
            width: '100%',
            maxWidth: '100%',
            padding: '8px 0',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}>
            {/* Question text - showing the question being asked */}
            {streamingQuestionText && (
              <div style={{
                fontSize: 11,
                color: '#6B7280',
                lineHeight: 1.5,
                marginBottom: 4,
                maxWidth: '100%',
                boxSizing: 'border-box',
                minWidth: 0,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#9CA3AF', fontSize: 10, whiteSpace: 'nowrap' }}>Q: </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{streamingQuestionText}</span>
              </div>
            )}
            {/* Answer shimmer - shows loading state for answer */}
            <div style={{
              paddingLeft: 14,
              maxWidth: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
              width: '100%',
            }}>
              <span style={{ color: '#9CA3AF', fontSize: 10, whiteSpace: 'nowrap' }}>A: </span>
              <div style={{ display: 'inline-block', width: 'calc(100% - 20px)' }}>
                <ShimmerLine width="85%" />
                <ShimmerLine width="70%" />
              </div>
            </div>
          </div>
        )}
        
        {questions.map((question) => (
          <button
            key={question.id}
            onClick={() => onQuestionClick(question.threadId, question.id)}
            onTouchStart={(e) => {
              // Optimize for mobile tap events
              e.currentTarget.style.opacity = '0.8'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            style={{
              width: '100%',
              maxWidth: '100%',
              padding: '8px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              borderRadius: 4,
              boxSizing: 'border-box',
              overflow: 'hidden', // Prevent content from overflowing
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB'
              e.currentTarget.style.paddingLeft = '4px'
              e.currentTarget.style.paddingRight = '4px'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.paddingLeft = '0'
              e.currentTarget.style.paddingRight = '0'
            }}
          >
            {/* Question text - styled as footnote */}
            <div style={{
              fontSize: 11,
              color: '#6B7280',
              lineHeight: 1.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: question.answer ? 4 : 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
              minWidth: 0,
              width: '100%',
            }}>
              <span style={{ color: '#9CA3AF', fontSize: 10, whiteSpace: 'nowrap' }}>Q: </span>
              <span>{question.content}</span>
            </div>
            {/* Answer text - styled as footnote */}
            {question.answer && (
              <div style={{
                fontSize: 11,
                color: '#6B7280',
                lineHeight: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
                paddingLeft: 14, // Indent to align with question text after "Q:"
                maxWidth: '100%',
                boxSizing: 'border-box',
                minWidth: 0, // Important for text truncation in flex containers
                width: '100%',
              }}>
                <span style={{ color: '#9CA3AF', fontSize: 10, whiteSpace: 'nowrap' }}>A: </span>
                <span>{question.answer}</span>
              </div>
            )}
          </button>
        ))}
      </div>
      
      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
      `}</style>
    </div>
  )
}
