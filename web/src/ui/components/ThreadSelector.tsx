import React, { useState, useRef, useEffect } from 'react'
import { useChat } from '../../contexts/ChatContext'

interface ThreadSelectorProps {
  documentId: string
  onNewThread: () => void
}

export function ThreadSelector({ documentId, onNewThread }: ThreadSelectorProps) {
  const { threads, activeThread, selectThread, isLoading } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const handleThreadSelect = async (threadId: string) => {
    await selectThread(threadId)
    setIsOpen(false)
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      // Use click instead of mousedown to allow button clicks to process first
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [isOpen])

  return (
    <div ref={menuRef} style={{ position: 'relative', width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Trigger button - minimal style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          color: '#374151',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: isLoading ? 0.6 : 1,
          transition: 'background-color 0.2s',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.backgroundColor = '#F3F4F6'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          flex: 1, 
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}>
          <svg 
            width="16" 
            height="16" 
            viewBox="-4 -4 40 40" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
          >
            <circle 
              cx="16" 
              cy="16" 
              r="15" 
              fill="none" 
              stroke="#686583" 
              strokeLinecap="square" 
              strokeMiterlimit="10" 
              strokeWidth="2.4"
            />
            <polyline 
              points="16 7 16 16 25 16" 
              fill="none" 
              stroke="#686583" 
              strokeLinecap="square" 
              strokeMiterlimit="10" 
              strokeWidth="2.4"
            />
          </svg>
          <span style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
            maxWidth: '100%',
          }}>
            {activeThread ? activeThread.title : 'Conversations'}
          </span>
          <span style={{ 
            fontSize: 10, 
            color: '#9CA3AF',
            marginLeft: 4,
            flexShrink: 0,
          }}>
            {threads.length > 0 && `(${threads.length})`}
          </span>
        </div>
        <svg 
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          <path 
            d="M3 4.5L6 7.5L9 4.5" 
            stroke="#6B7280" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Context menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          backgroundColor: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 1000,
          maxHeight: 320,
          overflowY: 'auto',
          overflowX: 'hidden',
          animation: 'fadeInMenu 0.15s ease-out',
          minWidth: 0,
          maxWidth: '100%',
        }}>
          {/* New conversation item */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onNewThread()
              setIsOpen(false)
            }}
            className="menu-item"
            style={{
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: 13,
              color: '#111827',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'background-color 0.15s',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
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
            <span style={{ fontWeight: 500 }}>New conversation</span>
          </button>

          {/* Separator */}
          {threads.length > 0 && (
            <div style={{
              height: 1,
              backgroundColor: '#E5E7EB',
              margin: '4px 0',
            }} />
          )}

          {/* Thread list */}
          {threads.length === 0 ? (
            <div style={{
              padding: '20px 12px',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: 12,
            }}>
              No conversations yet
            </div>
          ) : (
            threads.map((thread, index) => (
              <button
                key={thread.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleThreadSelect(thread.id)
                }}
                className="menu-item"
                style={{
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                  padding: '8px 12px',
                  backgroundColor: activeThread?.id === thread.id ? '#EFF6FF' : 'transparent',
                  border: 'none',
                  fontSize: 13,
                  color: '#374151',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'background-color 0.15s',
                  borderBottom: index < threads.length - 1 ? '1px solid #F3F4F6' : 'none',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  if (activeThread?.id !== thread.id) {
                    e.currentTarget.style.backgroundColor = '#F9FAFB'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeThread?.id !== thread.id) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
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
                    d="M3 4C3 3.44772 3.44772 3 4 3H12C12.5523 3 13 3.44772 13 4V9C13 9.55228 12.5523 10 12 10H8L5 12V10H4C3.44772 10 3 9.55228 3 9V4Z" 
                    stroke={activeThread?.id === thread.id ? '#2d66f5' : '#6B7280'} 
                    strokeWidth="1.5" 
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ 
                  flex: 1, 
                  minWidth: 0,
                  maxWidth: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    fontWeight: activeThread?.id === thread.id ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    color: activeThread?.id === thread.id ? '#2d66f5' : '#111827',
                    width: '100%',
                  }}>
                    {thread.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#9CA3AF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatTime(thread.updatedAt)}
                  </div>
                </div>
                {activeThread?.id === thread.id && (
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 14 14" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ flexShrink: 0 }}
                  >
                    <path 
                      d="M11.6667 3.5L5.25 9.91667L2.33334 7" 
                      stroke="#2d66f5" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Styles */}
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
