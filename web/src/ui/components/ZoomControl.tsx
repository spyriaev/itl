import React, { useState, useEffect } from 'react'

interface ZoomControlProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  isTablet?: boolean
  isChatVisible?: boolean
  scrollContainerRef?: React.RefObject<HTMLDivElement>
  isMobile?: boolean
}

export function ZoomControl({
  scale,
  onZoomIn,
  onZoomOut,
  onToggleFullscreen,
  isFullscreen = false,
  isTablet = false,
  isChatVisible = false,
  scrollContainerRef,
  isMobile = false,
}: ZoomControlProps) {
  const zoomPercentage = Math.round(scale * 100)
  const [leftPosition, setLeftPosition] = useState<string | number>('50%')
  
  // На планшете при открытом ассистенте ZoomControl должен быть под панелью
  const zIndex = isTablet && isChatVisible ? 1500 : 2000

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

      {/* Fullscreen Toggle */}
      {onToggleFullscreen && (
        <button
          onClick={onToggleFullscreen}
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
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
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
            {isFullscreen ? (
              // Exit fullscreen icon (arrows pointing inward)
              <>
                <polyline points="22 11 18 11 18 7 14 7 14 3" />
                <polyline points="2 13 6 13 6 17 10 17 10 21" />
                <polyline points="10 3 10 7 6 7 6 11 2 11" />
                <polyline points="14 21 14 17 18 17 18 13 22 13" />
              </>
            ) : (
              // Enter fullscreen icon (arrows pointing outward)
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <polyline points="21 15 21 21 15 21" />
                <polyline points="3 9 3 3 9 3" />
              </>
            )}
          </svg>
        </button>
      )}
    </div>
  )
}

