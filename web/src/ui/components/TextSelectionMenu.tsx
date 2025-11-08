import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const animationFrameRef = useRef<number | null>(null)
  const [menuPosition, setMenuPosition] = useState(position)

  useLayoutEffect(() => {
    setMenuPosition((prevPosition) => {
      if (prevPosition.top === position.top && prevPosition.left === position.left) {
        return prevPosition
      }
      return { top: position.top, left: position.left }
    })

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      if (!menuRef.current) {
        return
      }

      const padding = 8
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const rect = menuRef.current.getBoundingClientRect()

      let top = position.top
      let left = position.left

      if (rect.height > viewportHeight - padding * 2) {
        top = padding
      } else {
        const bottomOverflow = rect.bottom - (viewportHeight - padding)
        if (bottomOverflow > 0) {
          top = Math.max(padding, position.top - bottomOverflow)
        }

        if (rect.top < padding) {
          top = padding
        }
      }

      if (rect.width > viewportWidth - padding * 2) {
        left = padding
      } else {
        const rightOverflow = rect.right - (viewportWidth - padding)
        if (rightOverflow > 0) {
          left = Math.max(padding, position.left - rightOverflow)
        }

        if (rect.left < padding) {
          left = padding
        }
      }

      setMenuPosition((prevPosition) => {
        if (prevPosition.top === top && prevPosition.left === left) {
          return prevPosition
        }
        return { top, left }
      })
    })

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [position.left, position.top])

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
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        zIndex: 99999,
        width: 240,
        overflow: 'hidden',
        animation: 'fadeInMenu 0.1s ease-out',
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto',
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
          <span className="selected-text-quote"></span>
          <span key={selectedText} className="selected-text-highlight">
            {truncatedSelectedText}
          </span>
          <span className="selected-text-quote"></span>
        </div>
      </div>

      {/* Menu options */}
      <div
        style={{
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}
      >
        {options.map((option) => (
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
              padding: '6px 10px',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: 14,
              color: '#1F2937',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 8,
              transition: 'background-color 0.2s, color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
              e.currentTarget.style.color = '#1D4ED8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#1F2937'
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)'
              e.currentTarget.style.color = '#1D4ED8'
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
              {option.icon}
            </div>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
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

        .selected-text-highlight {
          display: inline-block;
          color: #2563EB;
          background: linear-gradient(
            90deg,
            #2563EB 0%,
            #2563EB 35%,
            #3B82F6 45%,
            #60A5FA 55%,
            #3B82F6 65%,
            #2563EB 100%
          );
          background-size: 250% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerBlueSelected 2s ease-in-out 0s 2;
          animation-fill-mode: forwards;
        }

        .selected-text-quote {
          color: #9CA3AF;
          font-style: normal;
        }

        @keyframes shimmerBlueSelected {
          0% {
            background-position: 150% center;
          }
          50% {
            background-position: 0% center;
          }
          100% {
            background-position: -150% center;
          }
        }
      `}</style>
    </div>
  )
}

