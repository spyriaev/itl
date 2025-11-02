import React, { useState, useRef } from 'react'
import { DocumentStructureItem } from '../../types/document'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  isStreaming?: boolean
  // Context selection props
  contextItems?: DocumentStructureItem[]
  currentPage?: number
  selectedLevel?: number | null | 'none'
  onContextChange?: (level: number | null | 'none') => void
}

export function ChatInput({ 
  value, 
  onChange, 
  onSend, 
  placeholder = "Ask a question about this document...",
  disabled = false,
  isStreaming = false,
  contextItems = [],
  currentPage = 1,
  selectedLevel = null,
  onContextChange
}: ChatInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [hasText, setHasText] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Sync external value with contentEditable
  React.useEffect(() => {
    if (editorRef.current && editorRef.current.textContent !== value) {
      editorRef.current.textContent = value
      setHasText(value.trim().length > 0)
    }
  }, [value])

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Проверяем, есть ли текст в редакторе
    if (editorRef.current) {
      setHasText((editorRef.current.textContent?.trim().length || 0) > 0)
    }
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const textContent = e.currentTarget.textContent?.trim() || ''
    setHasText(textContent.length > 0)
    onChange(textContent)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (hasText && !disabled && !isStreaming) {
        onSend()
        if (editorRef.current) {
          editorRef.current.textContent = ''
          setHasText(false)
        }
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasText && !disabled && !isStreaming) {
      onSend()
      if (editorRef.current) {
        editorRef.current.textContent = ''
        setHasText(false)
      }
    }
  }

  const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onContextChange) return
    const value = e.target.value
    if (value === 'page') {
      onContextChange(null)
    } else if (value === 'none') {
      onContextChange('none')
    } else if (value === 'chapter') {
      // Find the current chapter based on contextItems
      const currentChapter = contextItems.find(item => item.level === 1)
      if (currentChapter) {
        onContextChange(currentChapter.level)
      }
    }
  }

  const getContextDisplay = () => {
    if (selectedLevel === 'none') return ''
    if (selectedLevel === null) return `Page ${currentPage}`
    const item = contextItems.find(item => item.level === selectedLevel)
    if (item) {
      const cleanTitle = item.title
        .replace(/[☑☒☐✓✗×◊◆►▸▹►▲▼]/g, '')
        .replace(/[^\p{L}\p{N}\s.,;:!?()[\]{}""''-]/gu, '')
        .trim()
      return cleanTitle
    }
    return ''
  }

  const hasChapter = contextItems.some(item => item.level === 1)

  const getSelectedValue = () => {
    if (selectedLevel === 'none') return 'none'
    if (selectedLevel === null) return 'page'
    // If selectedLevel is a number, check if it's a valid chapter
    if (hasChapter) {
      return 'chapter'
    }
    // If no chapter structure, default to page
    return 'page'
  }

  return (
    <div style={styles.container}>
      {/* Context selector */}
      {onContextChange && (
        <div style={styles.repoSection}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={styles.icon}
              >
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
              </svg>
              <select
                value={getSelectedValue()}
                onChange={handleContextChange}
                disabled={disabled || isStreaming}
                style={styles.select}
              >
                <option value="none">No context</option>
                <option value="page">Current Page</option>
                {hasChapter && <option value="chapter">Current Chapter</option>}
              </select>
            </div>
            {getContextDisplay() && (
              <div style={styles.contextDisplay}>
                {getContextDisplay()}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div style={styles.inputContainer}>
        <div style={{ padding: 0 }}>
          <form style={styles.form} onSubmit={handleSubmit}>
            <div style={{ position: 'relative' }}>
              <div
                ref={editorRef}
                style={{
                  ...styles.editor,
                  backgroundColor: isStreaming || disabled ? '#F9FAFB' : 'transparent',
                  opacity: isStreaming || disabled ? 0.6 : 1,
                  cursor: disabled || isStreaming ? 'not-allowed' : 'text'
                }}
                contentEditable={!disabled && !isStreaming}
                role="textbox"
                spellCheck="true"
                onFocus={handleFocus}
                onBlur={handleBlur}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                suppressContentEditableWarning
              />
              <div style={styles.placeholder}>
                {isFocused || hasText ? '' : placeholder}
              </div>
            </div>
            
            <div style={styles.controls}>
              <div style={styles.leftControls}>
                {/* Left controls can be added here if needed */}
              </div>
              
              <div style={styles.rightControls}>
                <button
                  type="submit"
                  style={{
                    ...styles.submitButton,
                    ...((hasText && !disabled && !isStreaming) ? styles.submitButtonEnabled : {})
                  }}
                  disabled={!hasText || disabled || isStreaming}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 7-7 7 7"></path>
                    <path d="M12 19V5"></path>
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%'
  },
  inputContainer: {
    display: 'flex',
    width: '100%',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    borderRadius: '12px',
    cursor: 'text'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  editor: {
    color: '#374151',
    maxHeight: '400px',
    minHeight: '64px',
    width: '100%',
    resize: 'none',
    backgroundColor: 'transparent',
    padding: '12px',
    fontSize: '14px',
    outline: 'none',
    overflowY: 'auto',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  placeholder: {
    pointerEvents: 'none',
    position: 'absolute',
    left: '12px',
    top: '12px',
    fontSize: '14px',
    opacity: 1,
    color: '#6b7280',
    transition: 'opacity 0.2s ease',
    userSelect: 'none'
  },
  controls: {
    paddingBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px 0 12px'
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minHeight: '28px'
  },
  rightControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '-15px'
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '9999px',
    border: '1px solid #e5e7eb',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    cursor: 'not-allowed',
    outline: 'none',
    transition: 'all 0.2s ease'
  },
  submitButtonEnabled: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    color: 'white',
    cursor: 'pointer'
  },
  repoSection: {
    marginBottom: '8px',
    padding: '0 12px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    minHeight: '32px'
  },
  icon: {
    width: '14px',
    height: '14px',
    color: '#6b7280',
    transition: 'color 0.15s ease',
    flexShrink: 0
  },
  select: {
    flex: 1,
    padding: '6px 8px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
    paddingRight: '2.5rem'
  },
  contextDisplay: {
    fontSize: '11px',
    color: '#6b7280',
    paddingLeft: '20px',
    fontStyle: 'italic'
  }
}

// Add hover styles
const chatInputStyle = document.createElement('style')
chatInputStyle.textContent = `
  button[type="submit"]:not(:disabled):hover {
    background-color: #1d4ed8 !important;
    border-color: #1d4ed8 !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3) !important;
  }
  select {
    opacity: 1 !important;
  }
  select:not(:disabled):hover {
    color: #374151 !important;
  }
  select:disabled {
    opacity: 0.6 !important;
    cursor: not-allowed !important;
  }
  select:focus {
    outline: none;
  }
`
document.head.appendChild(chatInputStyle)

