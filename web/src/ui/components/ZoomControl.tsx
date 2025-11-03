import React, { useState, useEffect } from 'react'

interface ZoomControlProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToWidth?: () => void
  onFitToTextWidth?: () => void
  isTablet?: boolean
  isChatVisible?: boolean
  scrollContainerRef?: React.RefObject<HTMLDivElement>
  isMobile?: boolean
}

export function ZoomControl({
  scale,
  onZoomIn,
  onZoomOut,
  onFitToWidth,
  onFitToTextWidth,
  isTablet = false,
  isChatVisible = false,
  scrollContainerRef,
  isMobile = false,
}: ZoomControlProps) {
  const zoomPercentage = Math.round(scale * 100)
  const [leftPosition, setLeftPosition] = useState<string | number>('50%')
  
  // На планшете и мобильном при открытом ассистенте ZoomControl должен быть под панелью
  const zIndex = (isTablet || isMobile) && isChatVisible ? 1500 : 2000

  // Вычисляем позицию зум контрола
  useEffect(() => {
    const updatePosition = () => {
      // Если ассистент открыт на десктопе и есть доступ к контейнеру страницы
      if (isChatVisible && !isMobile && !isTablet && scrollContainerRef?.current) {
        const container = scrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        
        // Вычисляем центр контейнера страницы
        const containerCenter = containerRect.left + containerRect.width / 2
        
        setLeftPosition(containerCenter)
      } else {
        // По умолчанию - центр экрана
        setLeftPosition('50%')
      }
    }

    updatePosition()
    
    // Обновляем при изменении размера окна
    const handleResize = () => {
      setTimeout(updatePosition, 100)
    }
    
    window.addEventListener('resize', handleResize)
    
    // Если ассистент открыт, обновляем позицию после завершения анимации
    if (isChatVisible && !isMobile && !isTablet) {
      const timeoutId = setTimeout(updatePosition, 350)
      return () => {
        window.removeEventListener('resize', handleResize)
        clearTimeout(timeoutId)
      }
    }
    
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isChatVisible, isMobile, isTablet, scrollContainerRef])

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        left: leftPosition,
        transform: typeof leftPosition === 'number' ? `translateX(-50%)` : 'translateX(-50%)',
        zIndex: zIndex,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#1F2937',
        padding: '8px 12px',
        borderRadius: 8,
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -2px rgb(0 0 0 / 0.2)',
        transition: 'left 0.3s ease',
      }}
    >
      {/* Zoom Out Button */}
      <button
        onClick={onZoomOut}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        aria-label="Zoom out"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Zoom Percentage */}
      <span
        style={{
          fontSize: 14,
          color: 'white',
          fontWeight: 500,
          minWidth: 45,
          textAlign: 'center',
        }}
      >
        {zoomPercentage}%
      </span>

      {/* Zoom In Button */}
      <button
        onClick={onZoomIn}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        aria-label="Zoom in"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Separator */}
      <div
        style={{
          width: 1,
          height: 20,
          backgroundColor: '#4B5563',
        }}
      />

      {/* Fit to Width Button */}
      {onFitToWidth && (
        <button
          onClick={onFitToWidth}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          aria-label="Fit to width"
          title="Подобрать ширину"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="3" y1="9" x2="21" y2="9" />
          </svg>
        </button>
      )}

      {/* Fit to Text Width Button */}
      {onFitToTextWidth && (
        <button
          onClick={onFitToTextWidth}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          aria-label="Fit to text width"
          title="Подобрать ширину по тексту"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
            <path d="M6 6l-2 2 2 2" />
            <path d="M18 18l2-2-2-2" />
          </svg>
        </button>
      )}
    </div>
  )
}

