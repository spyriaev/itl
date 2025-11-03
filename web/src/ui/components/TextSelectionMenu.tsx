import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface TextSelectionMenuProps {
  position: { top: number; left: number }
  selectedText: string
  onOptionClick: (option: string, question: string) => void
  onClose: () => void
}

export function TextSelectionMenu({ position, selectedText, onOptionClick, onClose }: TextSelectionMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    // Add listener with small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [onClose])

  const handleOptionClick = (option: string, questionTemplate: string) => {
    const question = questionTemplate.replace('{text}', selectedText)
    onOptionClick(option, question)
    onClose()
  }

  const options = [
    {
      id: 'explainWithExample',
      label: t('textSelection.explainWithExample'),
      questionTemplate: t('textSelection.questionExplainWithExample', { text: selectedText })
    },
    {
      id: 'whatDoesThisMean',
      label: t('textSelection.whatDoesThisMean'),
      questionTemplate: t('textSelection.questionWhatDoesThisMean', { text: selectedText })
    },
    {
      id: 'moreInfo',
      label: t('textSelection.moreInfo'),
      questionTemplate: t('textSelection.questionMoreInfo', { text: selectedText })
    }
  ]

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        zIndex: 4000,
        minWidth: 200,
        overflow: 'hidden',
        animation: 'fadeInMenu 0.15s ease-out',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((option, index) => (
        <button
          key={option.id}
          onClick={() => handleOptionClick(option.id, option.questionTemplate)}
          style={{
            width: '100%',
            padding: '10px 14px',
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: 13,
            color: '#374151',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background-color 0.15s',
            borderBottom: index < options.length - 1 ? '1px solid #F3F4F6' : 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M8 3V13M3 8H13"
              stroke="#2d66f5"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>{option.label}</span>
        </button>
      ))}
      <style>{`
        @keyframes fadeInMenu {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

