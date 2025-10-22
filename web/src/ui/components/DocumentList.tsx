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
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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
      <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600, color: '#374151' }}>
          No documents yet
        </h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Upload your first PDF to get started
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>
          Your Documents ({documents.length})
        </h2>
        <button
          onClick={loadDocuments}
          style={{
            padding: '8px 16px',
            backgroundColor: '#F3F4F6',
            color: '#374151',
            border: '1px solid #D1D5DB',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            style={{
              padding: 20,
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              transition: 'box-shadow 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            onClick={() => onDocumentClick(doc.id)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>📄</div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {doc.title || 'Untitled Document'}
                </h3>
                
                <div style={{
                  display: 'flex',
                  gap: 16,
                  fontSize: 14,
                  color: '#6B7280',
                  flexWrap: 'wrap',
                }}>
                  <span>
                    📦 {formatFileSize(doc.sizeBytes)}
                  </span>
                  <span>
                    📅 {formatDate(doc.createdAt)}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: doc.status === 'uploaded' ? '#D1FAE5' : '#FEE2E2',
                    color: doc.status === 'uploaded' ? '#065F46' : '#991B1B',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {doc.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


