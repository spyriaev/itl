import React, { useState } from 'react'
import { PageQuestionsData } from '../../services/chatService'

interface PageRelatedQuestionsProps {
  questionsData: PageQuestionsData | null
  onQuestionClick: (threadId: string, messageId: string) => void
}

export function PageRelatedQuestions({ questionsData, onQuestionClick }: PageRelatedQuestionsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!questionsData || questionsData.totalQuestions === 0) {
    return null
  }

  const { totalQuestions, questions } = questionsData

  return (
    <div style={{
      marginTop: 12,
      padding: 12,
      backgroundColor: '#F0F9FF',
      borderRadius: 8,
      border: '1px solid #BAE6FD',
    }}>
      {/* Header with badge */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: '#0369A1',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
          }}>
            {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'} on this page
          </span>
        </div>
        <span style={{
          fontSize: 12,
          transition: 'transform 0.2s',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▼
        </span>
      </button>

      {/* Questions list */}
      {isExpanded && (
        <div style={{
          marginTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {questions.map((question) => (
            <button
              key={question.id}
              onClick={() => onQuestionClick(question.threadId, question.id)}
              style={{
                padding: 10,
                backgroundColor: 'white',
                border: '1px solid #BAE6FD',
                borderRadius: 6,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E0F2FE'
                e.currentTarget.style.borderColor = '#7DD3FC'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
                e.currentTarget.style.borderColor = '#BAE6FD'
              }}
            >
              <div style={{
                fontSize: 11,
                color: '#0369A1',
                marginBottom: 4,
                fontWeight: 500,
              }}>
                {question.threadTitle}
              </div>
              <div style={{
                fontSize: 13,
                color: '#374151',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {question.content}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
