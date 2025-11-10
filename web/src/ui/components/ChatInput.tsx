import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ContextType, DocumentStructureItem } from '../../types/document'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'

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
  contextType?: ContextType
  onContextChange?: (type: ContextType) => void
  chapterOptions?: DocumentStructureItem[]
  selectedChapterId?: string | null
  onChapterSelect?: (id: string | null) => void
  isMobile?: boolean
}

export function ChatInput({ 
  value, 
  onChange, 
  onSend, 
  placeholder,
  disabled = false,
  isStreaming = false,
  contextItems = [],
  currentPage = 1,
  contextType = 'page',
  onContextChange,
  chapterOptions = [],
  selectedChapterId = null,
  onChapterSelect,
  isMobile = false
}: ChatInputProps) {
  const { t } = useTranslation()
  const { isOffline } = useNetworkStatus()
  const defaultPlaceholder = placeholder || t("chatInput.askQuestion")
  const [isFocused, setIsFocused] = useState(false)
  const [hasText, setHasText] = useState(false)
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  
  // Block actions when offline
  const isDisabled = disabled || isStreaming || isOffline
  const offlinePlaceholder = isOffline 
    ? (t('offline.noConnection', 'Нет подключения к интернету') || 'Нет подключения к интернету')
    : defaultPlaceholder

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
      if (hasText && !isDisabled) {
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
    if (hasText && !isDisabled) {
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
    if (value === 'none') {
      onContextChange('none')
      handleChapterSelection(null)
      return
    }

    if (value === 'page') {
      onContextChange('page')
      handleChapterSelection(null)
      return
    }

    if (value === 'chapter') {
      onContextChange('chapter')
      handleChapterSelection(null)
      return
    }

    if (value.startsWith('chapter:')) {
    const chapterId = value.slice('chapter:'.length)
    onContextChange('chapter')
    handleChapterSelection(chapterId === 'default' ? null : chapterId)
    }
  }

  const handleMobileContextChange = (value: string) => {
    if (!onContextChange) return
    if (value === 'none') {
      onContextChange('none')
      handleChapterSelection(null)
    } else if (value === 'page') {
      onContextChange('page')
      handleChapterSelection(null)
    } else if (value === 'chapter') {
      onContextChange('chapter')
      handleChapterSelection(null)
    } else if (value.startsWith('chapter:')) {
      const chapterId = value.slice('chapter:'.length)
      onContextChange('chapter')
      handleChapterSelection(chapterId === 'default' ? null : chapterId)
    }
    setIsContextMenuOpen(false)
  }

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setIsContextMenuOpen(false)
      }
    }

    if (isContextMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [isContextMenuOpen])

  const sanitizeTitle = (title: string) => title
    .replace(/[☑☒☐✓✗×◊◆►▸▹►▲▼]/g, '')
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]{}""''-]/gu, '')
    .trim()

  const selectedChapter = React.useMemo(() => {
    if (!selectedChapterId) return null
    return chapterOptions.find(item => item.id === selectedChapterId) || null
  }, [selectedChapterId, chapterOptions])

  const formatPageRange = (item: DocumentStructureItem | null | undefined) => {
    if (!item) return ''
    if (item.pageTo) {
      return `${item.pageFrom}–${item.pageTo}`
    }
    return `${item.pageFrom}–${t("chatInput.toEnd", "end")}`
  }

  const getContextDisplay = () => {
    if (contextType === 'none') return ''
    if (contextType === 'page') return `${t("chatMessage.page")} ${currentPage}`
    return t("chatInput.currentChapter")
  }

  const hasChapter = chapterOptions.length > 0

  // Effect to reset invalid chapter selection when chapter structure disappears
  React.useEffect(() => {
    if (onContextChange && contextType === 'chapter' && !hasChapter) {
      onContextChange('page')
      onChapterSelect?.(null)
    }
  }, [hasChapter, contextType, onContextChange, onChapterSelect])

  const contextSelectorValue =
    contextType === 'chapter'
      ? `chapter:${selectedChapterId || 'default'}`
      : contextType

  const handleChapterSelection = (chapterId: string | null) => {
    if (chapterId) {
      onChapterSelect?.(chapterId)
    } else {
      onChapterSelect?.(null)
    }
  }

  const editorStyle = React.useMemo<React.CSSProperties>(() => ({
    ...styles.editor,
    fontSize: isMobile ? '16px' : styles.editor.fontSize,
    lineHeight: isMobile ? '24px' : '20px',
    padding: isMobile ? '14px 16px' : styles.editor.padding,
    WebkitTextSizeAdjust: '100%',
  }), [isMobile])

  const placeholderStyle = React.useMemo<React.CSSProperties>(() => ({
    ...styles.placeholder,
    fontSize: isMobile ? '16px' : styles.placeholder.fontSize,
    lineHeight: isMobile ? '24px' : '20px',
  }), [isMobile])

  const contextSelectorStyle = React.useMemo<React.CSSProperties>(() => ({
    ...styles.select,
    fontSize: isMobile ? '16px' : styles.select.fontSize,
    padding: isMobile ? '10px 14px' : styles.select.padding,
    paddingRight: isMobile ? '2.75rem' : styles.select.paddingRight,
    lineHeight: isMobile ? '24px' : '20px',
  }), [isMobile])

  return (
    <div style={styles.container}>
      {/* Context selector */}
      {onContextChange && (
        <div style={styles.repoSection}>
          <div ref={contextMenuRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                viewBox="-4 -4 40 40" 
                style={styles.icon}
              >
                <circle 
                  fill="none" 
                  stroke="#686583" 
                  strokeWidth="2.4" 
                  strokeLinecap="square" 
                  strokeMiterlimit="10" 
                  cx="5" 
                  cy="5" 
                  r="4" 
                  strokeLinejoin="miter"
                />
                <line 
                  fill="none" 
                  stroke="#686583" 
                  strokeWidth="2.4" 
                  strokeLinecap="square" 
                  strokeMiterlimit="10" 
                  x1="15" 
                  y1="5" 
                  x2="31" 
                  y2="5" 
                  strokeLinejoin="miter"
                />
                <line 
                  fill="none" 
                  stroke="#686583" 
                  strokeWidth="2.4" 
                  strokeLinecap="square" 
                  strokeMiterlimit="10" 
                  x1="15" 
                  y1="13" 
                  x2="31" 
                  y2="13" 
                  strokeLinejoin="miter"
                />
                <circle 
                  fill="none" 
                  stroke="#686583" 
                  strokeWidth="2.4" 
                  strokeLinecap="square" 
                  strokeMiterlimit="10" 
                  cx="5" 
                  cy="21" 
                  r="4" 
                  strokeLinejoin="miter"
                />
                <line 
                  fill="none" 
                  stroke="#686583" 
                  strokeWidth="2.4" 
                  strokeLinecap="square" 
                  strokeMiterlimit="10" 
                  x1="15" 
                  y1="21" 
                  x2="31" 
                  y2="21" 
                  strokeLinejoin="miter"
                />
                <line 
                  fill="none" 
                  stroke="#686583" 
                  strokeWidth="2.4" 
                  strokeLinecap="square" 
                  strokeMiterlimit="10" 
                  x1="15" 
                  y1="29" 
                  x2="31" 
                  y2="29" 
                  strokeLinejoin="miter"
                />
              </svg>
              {isMobile ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsContextMenuOpen(!isContextMenuOpen)
                    }}
                    disabled={isDisabled}
                    style={{
                      ...contextSelectorStyle,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: (disabled || isStreaming) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span style={{ 
                      flex: 1, 
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {contextType === 'none'
                        ? t("chatInput.noContext")
                        : contextType === 'page'
                          ? t("chatInput.currentPage")
                          : (getContextDisplay() || t("chatInput.currentChapter"))}
                    </span>
                  </button>
                  {isContextMenuOpen && (
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
                      overflow: 'hidden',
                      minWidth: 200,
                      animation: 'fadeInMenu 0.15s ease-out',
                    }}>
                      <button
                        type="button"
                        onClick={() => handleMobileContextChange('none')}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: contextType === 'none' ? '#EFF6FF' : 'transparent',
                          border: 'none',
                          fontSize: 13,
                          color: contextType === 'none' ? '#2d66f5' : '#374151',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {contextType === 'none' && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="#2d66f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {t("chatInput.noContext")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileContextChange('page')}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: contextType === 'page' ? '#EFF6FF' : 'transparent',
                          border: 'none',
                          fontSize: 13,
                          color: contextType === 'page' ? '#2d66f5' : '#374151',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderTop: '1px solid #F3F4F6',
                        }}
                      >
                        {contextType === 'page' && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="#2d66f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {t("chatInput.currentPage")}
                      </button>
                      {hasChapter && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button
                            type="button"
                            onClick={() => handleMobileContextChange('chapter')}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: contextType === 'chapter' ? '#EFF6FF' : 'transparent',
                              border: 'none',
                              fontSize: 13,
                              color: contextType === 'chapter' ? '#2d66f5' : '#374151',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              borderTop: '1px solid #F3F4F6',
                            }}
                          >
                            {contextType === 'chapter' && !selectedChapterId && (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="#2d66f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                            {t("chatInput.currentChapter")}
                          </button>
                          {chapterOptions.map(item => {
                            const isSelected = contextType === 'chapter' && selectedChapterId === item.id
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleMobileContextChange(`chapter:${item.id}`)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px 8px 24px',
                                  backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                                  border: 'none',
                                  fontSize: 13,
                                  color: isSelected ? '#2d66f5' : '#374151',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  gap: 4,
                                  borderTop: '1px solid #F3F4F6',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isSelected && (
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M11.6667 3.5L5.25 9.91667L2.33334 7" stroke="#2d66f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                  {sanitizeTitle(item.title)}
                                </span>
                                <span style={{ marginLeft: isSelected ? 22 : 6, fontSize: 11, color: '#6B7280' }}>
                                  {item.pageTo ? `${item.pageFrom}–${item.pageTo}` : `${item.pageFrom}–${t("chatInput.toEnd", "end")}`}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <select
                  value={contextSelectorValue}
                  onChange={handleContextChange}
                  disabled={isDisabled}
                  style={contextSelectorStyle}
                >
                  <option value="none">{t("chatInput.noContext")}</option>
                  <option value="page">{t("chatInput.currentPage")}</option>
                  {hasChapter && (
                    <optgroup label={t("chatInput.currentChapter")}>
                      {chapterOptions.map(item => {
                        return (
                          <option key={item.id} value={`chapter:${item.id}`}>
                            {`${sanitizeTitle(item.title)}`}
                          </option>
                        )
                      })}
                    </optgroup>
                  )}
                </select>
              )}
            </div>
            {getContextDisplay() && (
              <div style={{ ...styles.contextDisplay, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {contextType === 'chapter' && selectedChapter && (
                  <>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                    {t("chatMessage.page")} {formatPageRange(selectedChapter)}
                    </span>
                  </>
                )}
                {contextType === 'page' && (
                  <span style={{ fontSize: 12, color: '#6B7280' }}>
                    {t("chatMessage.page")} {currentPage}
                  </span>
                )}
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
                  ...editorStyle,
                  backgroundColor: isDisabled ? '#F9FAFB' : 'transparent',
                  opacity: isDisabled ? 0.6 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'text'
                }}
                contentEditable={!isDisabled}
                role="textbox"
                spellCheck="true"
                onFocus={handleFocus}
                onBlur={handleBlur}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                suppressContentEditableWarning
              />
              <div style={placeholderStyle}>
                {isFocused || hasText ? '' : offlinePlaceholder}
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
                    ...((hasText && !isDisabled) ? styles.submitButtonEnabled : {})
                  }}
                  disabled={!hasText || isDisabled}
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
    border: '1px solid #3b82f6',
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

