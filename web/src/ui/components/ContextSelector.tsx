import React from 'react'
import { ChapterInfo, DocumentStructureItem } from '../../types/document'

interface ContextSelectorProps {
  contextItems: DocumentStructureItem[]
  currentPage: number
  selectedLevel: number | null | 'none'
  onChange: (level: number | null | 'none') => void
  disabled?: boolean
}

type ContextType = 'page' | number | 'none'

export function ContextSelector({
  contextItems,
  currentPage,
  selectedLevel,
  onChange,
  disabled = false
}: ContextSelectorProps) {
  const getSelectedItem = () => {
    if (selectedLevel === null || selectedLevel === 'none') return null
    return contextItems.find(item => item.level === selectedLevel) || null
  }

  const selectedItem = getSelectedItem()

  return (
    <div style={{
      padding: '8px 12px',
      backgroundColor: '#F3F4F6',
      borderRadius: 6,
      border: '1px solid #E5E7EB',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ 
          fontSize: 14, 
          fontWeight: 500, 
          color: '#111827',
          minWidth: 'fit-content'
        }}>
          Context:
        </span>
        <select
          value={selectedLevel === 'none' ? 'none' : (selectedLevel || '')}
          onChange={(e) => {
            const value = e.target.value
            if (value === '') {
              onChange(null)
            } else if (value === 'none') {
              onChange('none')
            } else {
              onChange(parseInt(value))
            }
          }}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '6px 8px',
            border: '1px solid #D1D5DB',
            borderRadius: 4,
            fontSize: 13,
            backgroundColor: disabled ? '#F9FAFB' : 'white',
            color: disabled ? '#9CA3AF' : '#111827',
            cursor: disabled ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <option value="none" style={{ whiteSpace: 'nowrap' }}>
            None
          </option>
          <option value="" style={{ whiteSpace: 'nowrap' }}>
            Current Page
          </option>
          {contextItems.map(item => (
            <option key={item.id} value={item.level} style={{ whiteSpace: 'nowrap' }}>
              {item.level === 1 ? 'Current Chapter' : 'Current Section'}
            </option>
          ))}
        </select>
      </div>
      {selectedLevel === 'none' ? (
        <div style={{ 
          fontSize: 11, 
          color: '#6B7280',
          marginTop: 4,
          paddingLeft: 4,
        }}>
          <span style={{ fontSize: 10 }}>
            No context
          </span>
        </div>
      ) : selectedLevel === null ? (
        <div style={{ 
          fontSize: 11, 
          color: '#6B7280',
          marginTop: 4,
          paddingLeft: 4,
        }}>
          <span style={{ fontSize: 10 }}>
            Page {currentPage}
          </span>
        </div>
      ) : selectedItem && (
        <div style={{ 
          fontSize: 11, 
          color: '#6B7280',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          marginTop: 4,
          paddingLeft: 4,
        }}>
          <span style={{ 
            fontWeight: 500, 
            color: '#111827',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {selectedItem.title
              .replace(/[☑☒☐✓✗×◊◆►▸▹►▲▼]/g, '') // checkbox and arrow symbols
              .replace(/[^\p{L}\p{N}\s.,;:!?()[\]{}""''-]/gu, '') // keep all letters (including Cyrillic), numbers, and common punctuation
              .trim()}
          </span>
          <span style={{ fontSize: 10 }}>
            Pages {selectedItem.pageFrom}-{selectedItem.pageTo || 'end'}
          </span>
        </div>
      )}
    </div>
  )
}
