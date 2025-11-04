import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useChat } from '../../contexts/ChatContext'
import '../styles/text-elements.css'

interface ThreadSelectorProps {
  documentId: string
  onNewThread: () => void
  isMobile?: boolean
}

export function ThreadSelector({ documentId, onNewThread, isMobile = false }: ThreadSelectorProps) {
  const { t } = useTranslation()
  const { threads, activeThread, selectThread, isLoading } = useChat()
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  // Update menu position when opening
  useEffect(() => {
    if (isOpen && isMobile && buttonRef.current) {
      // Use requestAnimationFrame to ensure button is rendered
      requestAnimationFrame(() => {
        if (buttonRef.current) {
          const buttonRect = buttonRef.current.getBoundingClientRect()
          setMenuPosition({
            top: buttonRect.bottom + 4,
            left: buttonRect.left,
            width: buttonRect.width
          })
        }
      })
    } else if (!isOpen) {
      // Reset position when closing
      setMenuPosition({ top: 0, left: 0, width: 0 })
    }
  }, [isOpen, isMobile])

  // Close menu when clicking outside (only for desktop)
  useEffect(() => {
    if (!isMobile && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && buttonRef.current && 
            !menuRef.current.contains(event.target as Node) &&
            !buttonRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      // Use a small delay to avoid immediate closure
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [isOpen, isMobile])

  return (
    <div ref={menuRef} style={{ 
      position: 'relative', 
      width: '100%', 
      minWidth: 0, 
      maxWidth: '100%',
    }}>
      {/* Trigger button - minimal style */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
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
            color: '#374151',
          }}>
            {activeThread ? activeThread.title : t("threadSelector.conversations")}
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
      {isOpen && (() => {
        const menuContent = (
          <>
            {isMobile && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  zIndex: 2999,
                  pointerEvents: 'auto',
                }}
              />
            )}
            <div 
              ref={isMobile ? null : menuRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? `${menuPosition.top}px` : '100%',
                left: isMobile ? `${menuPosition.left}px` : (isMobile ? -16 : 0),
                width: isMobile ? `${menuPosition.width}px` : undefined,
                right: isMobile ? undefined : (isMobile ? -16 : 0),
                marginTop: isMobile ? 0 : 4,
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                zIndex: isMobile ? 3000 : 2000,
                maxHeight: isMobile ? '60vh' : 320,
                overflowY: 'auto',
                overflowX: 'hidden',
                animation: 'fadeInMenu 0.15s ease-out',
                minWidth: 0,
                boxSizing: 'border-box',
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
            <span style={{ fontWeight: 500 }}>{t("threadSelector.newConversation")}</span>
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
              {t("threadSelector.noConversations")}
            </div>
          ) : (
            threads.map((thread: any, index: number) => (
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
                    // Ensure text color stays gray, not blue
                    const textDiv = e.currentTarget.querySelector('div > div:first-child') as HTMLElement
                    if (textDiv) {
                      textDiv.style.color = '#111827'
                    }
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
                    transition: 'color 0.15s ease',
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
          </>
        )

        return isMobile && typeof document !== 'undefined' 
          ? createPortal(menuContent, document.body)
          : menuContent
      })()}

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
        @keyframes slideUpMenu {
          from {
            opacity: 0;
            transform: translateY(100%);
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
