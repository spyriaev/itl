"use client"

import { useState, useEffect } from "react"
import { fetchDocuments, type DocumentMetadata } from "../../services/uploadService"

interface DocumentListProps {
  refreshTrigger?: number
  onDocumentClick: (documentId: string) => void
  loadingDocumentId?: string | null
}

export function DocumentList({ refreshTrigger, onDocumentClick, loadingDocumentId }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const docs = await fetchDocuments()
      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [refreshTrigger])

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 480px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      // both types have .matches
      // @ts-ignore - narrow for runtime
      setIsMobile(!!e.matches)
    }
    handler(mql)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void)
      return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void)
    } else {
      // Safari <14 fallback
      // @ts-ignore
      mql.addListener(handler)
      return () => {
        // @ts-ignore
        mql.removeListener(handler)
      }
    }
  }, [])

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || bytes < 0) {
      return "Unknown size"
    }

    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return "Unknown date"

    const date = new Date(dateStr)

    if (isNaN(date.getTime())) {
      return "Invalid date"
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="document-list-loading">
        <div className="document-list-loading-icon">⏳</div>
        <p className="document-list-loading-text">Loading documents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="document-list-error">
        <p className="document-list-error-text">
          <strong>Error:</strong> {error}
        </p>
        <button onClick={loadDocuments} className="document-list-error-button">
          Retry
        </button>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
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
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Refresh Button */}
      <div className="refresh-button-container">
        <button onClick={loadDocuments} className="refresh-button">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Refresh
        </button>
      </div>

      {/* List */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => loadingDocumentId !== doc.id && onDocumentClick(doc.id)}
              style={{
                textAlign: 'left',
                padding: 12,
                border: '1px solid #EEF0F3',
                borderRadius: 12,
                backgroundColor: loadingDocumentId === doc.id ? '#f8f9fa' : 'white',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                cursor: loadingDocumentId === doc.id ? 'wait' : 'pointer',
              }}
            >
              <svg
                className="document-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="document-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title || 'Untitled Document'}
                  </span>
                  {doc.status === 'uploaded' && (
                    <span className="document-questions-badge">{Math.floor(Math.random() * 10) + 1}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, color: '#6e7787', fontSize: 13 }}>
                  {loadingDocumentId === doc.id ? (
                    <span>Loading...</span>
                  ) : doc.status === "uploaded" ? (
                    <>
                      <span>Size: {formatFileSize(doc.sizeBytes)}</span>
                      <span>Modified: {formatDate(doc.createdAt)}</span>
                    </>
                  ) : (
                    <span>Loading...</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="document-list-container">
          <table className="document-table">
            <thead className="document-table-header">
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Last modified</th>
                <th>Questions</th>
              </tr>
            </thead>
            <tbody className="document-table-body">
              {documents.map((doc) => (
                <tr 
                  key={doc.id} 
                  onClick={() => loadingDocumentId !== doc.id && onDocumentClick(doc.id)}
                  style={{ 
                    cursor: loadingDocumentId === doc.id ? 'wait' : 'pointer',
                    backgroundColor: loadingDocumentId === doc.id ? '#f8f9fa' : 'transparent'
                  }}
                >
                  <td>
                    <div className="document-name-cell">
                      <svg
                        className="document-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      <span className="document-name">{doc.title || "Untitled Document"}</span>
                    </div>
                  </td>
                  <td className="document-size">
                    {loadingDocumentId === doc.id ? "Loading..." : (doc.status === "uploaded" ? formatFileSize(doc.sizeBytes) : "Loading...")}
                  </td>
                  <td className="document-date">
                    {loadingDocumentId === doc.id ? "Loading..." : (doc.status === "uploaded" ? formatDate(doc.createdAt) : "Loading...")}
                  </td>
                  <td>
                    {doc.status === "uploaded" && (
                      <span className="document-questions-badge">{Math.floor(Math.random() * 10) + 1}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
