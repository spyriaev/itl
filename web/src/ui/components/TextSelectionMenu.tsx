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
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Don't close if clicking inside the menu
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    // Add listener with small delay to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside as EventListener, true)
      document.addEventListener('touchend', handleClickOutside as EventListener, { passive: true })
    }, 100) // Increased delay to ensure menu is fully rendered

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside as EventListener, true)
      document.removeEventListener('touchend', handleClickOutside as EventListener)
    }
  }, [onClose])

  const handleOptionClick = (e: React.MouseEvent | React.TouchEvent, option: string, questionTemplate: string) => {
    e.preventDefault()
    e.stopPropagation()
    const question = questionTemplate.replace('{text}', selectedText)
    onOptionClick(option, question)
    onClose()
  }

  // Truncate selected text to max 2 lines (CSS will handle the actual truncation)
  // This function is just for approximate length estimation
  const truncateText = (text: string, maxLines: number = 2): string => {
    // CSS will handle the actual truncation with -webkit-line-clamp
    // This is just to ensure we don't pass extremely long text
    const maxLength = maxLines * 60 // Approximate characters per line
    if (text.length <= maxLength) {
      return text
    }
    // Return full text - CSS will truncate it visually
    return text
  }

  const options = [
    {
      id: 'explainWithExample',
      label: t('textSelection.explainWithExample'),
      questionTemplate: t('textSelection.questionExplainWithExample', { text: selectedText }),
      icon: (
        <svg width="16" height="16" viewBox="-4 -4 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline fill="none" stroke="#000000" strokeWidth="2.4" strokeMiterlimit="10" points="2,6 16,10 30,6" strokeLinejoin="miter" strokeLinecap="butt"/>
          <line fill="none" stroke="#000000" strokeWidth="2.4" strokeMiterlimit="10" x1="16" y1="10" x2="16" y2="30" strokeLinejoin="miter" strokeLinecap="butt"/>
          <polygon fill="none" stroke="#000000" strokeWidth="2.4" strokeLinecap="square" strokeMiterlimit="10" points="30,25 16,30 2,25 2,6 16,2 30,6" strokeLinejoin="miter"/>
        </svg>
      )
    },
    {
      id: 'whatDoesThisMean',
      label: t('textSelection.whatDoesThisMean'),
      questionTemplate: t('textSelection.questionWhatDoesThisMean', { text: selectedText }),
      icon: (
        <svg width="16" height="16" viewBox="-4 -4 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
          <circle cx="24.5" cy="7.5" r="5.5" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
          <circle cx="7.5" cy="24.5" r="5.5" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
          <circle cx="24.5" cy="24.5" r="5.5" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
        </svg>
      )
    },
    {
      id: 'moreInfo',
      label: t('textSelection.moreInfo'),
      questionTemplate: t('textSelection.questionMoreInfo', { text: selectedText }),
      icon: (
        <svg width="16" height="16" viewBox="-4 -4 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="11" height="11" rx="2" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
          <rect x="18.356" y="3.356" width="10.288" height="10.288" rx="1.871" transform="translate(0.873 19.107) rotate(-45)" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
          <rect x="18" y="18" width="11" height="11" rx="2" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
          <rect x="3" y="18" width="11" height="11" rx="2" fill="none" stroke="#000000" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2.4"/>
        </svg>
      )
    }
  ]

  const truncatedSelectedText = truncateText(selectedText, 2)

  return (
    <div
      ref={menuRef}
      data-text-selection-menu
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        zIndex: 99999,
        width: 240,
        overflow: 'hidden',
        animation: 'fadeInMenu 0.1s ease-out',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Display selected text */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #F3F4F6',
          backgroundColor: '#F9FAFB',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#6B7280',
            fontStyle: 'italic',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-word',
          }}
        >
          "{truncatedSelectedText}"
        </div>
      </div>

      {/* Menu options */}
      {options.map((option, index) => (
        <button
          key={option.id}
          onClick={(e) => handleOptionClick(e, option.id, option.questionTemplate)}
          onTouchEnd={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleOptionClick(e, option.id, option.questionTemplate)
          }}
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
          onTouchStart={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {option.icon}
          </div>
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

