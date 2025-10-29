import React, { useState, useEffect } from 'react'
import { fetchDocuments, DocumentMetadata } from '../../services/uploadService'

interface DocumentListProps {
  refreshTrigger?: number
  onDocumentClick: (documentId: string) => void
}

export function DocumentList({ refreshTrigger, onDocumentClick }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const docs = await fetchDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [refreshTrigger])

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || bytes < 0) {
      return 'Unknown size'
    }
    
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Unknown date'
    
    const date = new Date(dateStr)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date'
    }
    
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <p>Loading documents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: 24,
        backgroundColor: '#FEE2E2',
        border: '1px solid #FCA5A5',
        borderRadius: 8,
        color: '#991B1B',
      }}>
        <strong>Error:</strong> {error}
        <button
          onClick={loadDocuments}
          style={{
            marginLeft: 16,
            padding: '6px 12px',
            backgroundColor: '#DC2626',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div>
        <div className="info-card">
          <div className="info-card-title">MORE OF WHAT YOU CAN DO:</div>

          <div className="info-card-items">
            <div className="info-card-item">
              <svg
                className="info-card-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
              <div className="info-card-content">
                <span className="info-card-item-title">Take Your Files Anywhere</span>{" "}
                <span className="info-card-item-description">for easy access on all your devices</span>
              </div>
            </div>

            <div className="info-card-item">
              <svg
                className="info-card-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <div className="info-card-content">
                <span className="info-card-item-title">Supported Files</span>{" "}
                <span className="info-card-item-description">upload PDF files with a maximum size of 25 MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 24,
        borderTop: '1px solid #E5E7EB',
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111827' }}>
          Ваши документы ({documents.length})
        </h2>
        <button
          onClick={loadDocuments}
          style={{
            padding: '8px 16px',
            backgroundColor: 'white',
            color: '#374151',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
            e.currentTarget.style.borderColor = '#9CA3AF'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white'
            e.currentTarget.style.borderColor = '#D1D5DB'
          }}
        >
          <img src="/icons/lucide-RefreshCcw-Outlined.svg" alt="" style={{ width: 16, height: 16 }} />
          Обновить
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            style={{
              padding: '16px 20px',
              backgroundColor: 'white',
              border: '1px solid #F3F4F6',
              borderRadius: 8,
              transition: 'background-color 0.2s',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            onClick={() => onDocumentClick(doc.id)}
          >
            <img src="/icons/lucide-FileText-Outlined.svg" alt="" style={{ width: 24, height: 24, flexShrink: 0, opacity: 0.6 }} />
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: 14,
                fontWeight: 400,
                color: '#374151',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {doc.title || 'Untitled Document'}
              </h3>
              
              <div style={{
                display: 'flex',
                gap: 16,
                fontSize: 13,
                color: '#6B7280',
                alignItems: 'center',
              }}>
                <span>
                  {formatFileSize(doc.sizeBytes)}
                </span>
                <span>
                  {formatDate(doc.createdAt)}
                </span>
                <span style={{
                  padding: '2px 10px',
                  backgroundColor: doc.status === 'uploaded' ? '#374151' : '#DBEAFE',
                  color: doc.status === 'uploaded' ? '#FFFFFF' : '#1E40AF',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                }}>
                  {doc.status === 'uploaded' ? 'загружено' : doc.status === 'processing' ? 'обрабатывается' : doc.status}
                </span>
              </div>
            </div>

            <div style={{
              fontSize: 18,
              color: '#9CA3AF',
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1,
              transform: 'rotate(90deg)',
            }}>
              ⋯
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
