import React, { useState } from 'react'
import { useChat } from '../../contexts/ChatContext'

interface ThreadSelectorProps {
  documentId: string
  onNewThread: () => void
}

export function ThreadSelector({ documentId, onNewThread }: ThreadSelectorProps) {
  const { threads, activeThread, selectThread, isLoading } = useChat()
  const [isOpen, setIsOpen] = useState(false)

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

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Thread selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: 'white',
          border: '1px solid #D1D5DB',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          color: '#374151',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💬</span>
          <span style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            maxWidth: 200 
          }}>
            {activeThread ? activeThread.title : 'Select conversation...'}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#6B7280' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #D1D5DB',
          borderRadius: 8,
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
          zIndex: 1000,
          maxHeight: 300,
          overflowY: 'auto',
        }}>
          {/* New conversation button */}
          <button
            onClick={() => {
              onNewThread()
              setIsOpen(false)
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#F9FAFB',
              border: 'none',
              borderBottom: '1px solid #E5E7EB',
              fontSize: 14,
              fontWeight: 500,
              color: '#3B82F6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>➕</span>
            <span>New conversation</span>
          </button>

          {/* Thread list */}
          {threads.length === 0 ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: '#6B7280',
              fontSize: 14,
            }}>
              No conversations yet
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => handleThreadSelect(thread.id)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: activeThread?.id === thread.id ? '#EFF6FF' : 'white',
                  border: 'none',
                  borderBottom: '1px solid #E5E7EB',
                  fontSize: 14,
                  color: '#374151',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                }}
              >
                <div style={{
                  fontWeight: activeThread?.id === thread.id ? 600 : 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}>
                  {thread.title}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6B7280',
                }}>
                  {formatTime(thread.updatedAt)}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
