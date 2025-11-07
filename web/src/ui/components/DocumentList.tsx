"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { type DocumentMetadata } from "../../services/uploadService"
import { isPdfCached } from "../../services/pdfCache"
import { ShareDocumentButton } from "./ShareDocumentButton"

interface DocumentListProps {
  documents: DocumentMetadata[]
  loading: boolean
  onDocumentClick: (documentId: string) => void
  loadingDocumentId?: string | null
  onRefresh?: () => void
}

// Page badge component
function PageBadge({ currentPage }: { currentPage?: number | null }) {
  if (!currentPage || currentPage <= 1) {
    return null
  }

  return (
    <span className="document-page-badge" title={`Прочитано страниц: ${currentPage}`}>
      {currentPage}
    </span>
  )
}

// Cache badge component
function CacheBadge({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const [isCached, setIsCached] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    
    isPdfCached(documentId).then((cached) => {
      if (!cancelled) {
        setIsCached(cached)
      }
    })

    return () => {
      cancelled = true
    }
  }, [documentId])

  if (isCached === null || !isCached) {
    return null
  }

  return (
    <span 
      className="document-cache-badge" 
      title={t("documentList.cachedTooltip", "Файл закеширован")}
      style={{
        fontSize: 11,
        color: '#10B981',
        backgroundColor: '#D1FAE5',
        padding: '2px 6px',
        borderRadius: 4,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 13l4 4L19 7"></path>
      </svg>
      {t("documentList.cached", "Кеш")}
    </span>
  )
}

export function DocumentList({ documents, loading, onDocumentClick, loadingDocumentId, onRefresh }: DocumentListProps) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

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
      return t("documentList.unknownSize")
    }

    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return t("documentList.unknownDate")

    const date = new Date(dateStr)

    if (isNaN(date.getTime())) {
      return t("documentList.invalidDate")
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
        <p className="document-list-loading-text">{t("documentList.loadingDocuments")}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="document-list-error">
        <p className="document-list-error-text">
          <strong>{t("documentList.error")}</strong> {error}
        </p>
        {onRefresh && (
          <button onClick={onRefresh} className="document-list-error-button">
            {t("documentList.retry")}
          </button>
        )}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="info-card">
        <div className="info-card-title">{t("documentList.moreCanDo")}</div>

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
              <span className="info-card-item-title">{t("documentList.takeFilesAnywhere")}</span>{" "}
              <span className="info-card-item-description">{t("documentList.takeFilesAnywhereDesc")}</span>
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
              <span className="info-card-item-title">{t("documentList.supportedFiles")}</span>{" "}
              <span className="info-card-item-description">{t("documentList.supportedFilesDesc")}</span>
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
        {onRefresh && (
          <button onClick={onRefresh} className="refresh-button">
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
            {t("documentList.refresh")}
          </button>
        )}
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
              <div className="document-icon-container">
                <PageBadge currentPage={doc.lastViewedPage} />
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
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span className="document-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {doc.title || t("documentList.untitledDocument")}
                    </span>
                    {(doc.isShared || doc.hasActiveShare) && (
                      <span style={{ 
                        fontSize: 11, 
                        color: '#6B7280', 
                        backgroundColor: '#F3F4F6', 
                        padding: '2px 6px', 
                        borderRadius: 4,
                        flexShrink: 0
                      }}>
                        {t("documentList.shared")}
                      </span>
                    )}
                    {doc.status === 'uploaded' && <CacheBadge documentId={doc.id} />}
                    {doc.status === 'uploaded' && doc.questionsCount !== undefined && doc.questionsCount > 0 && (
                      <span className="document-questions-badge" style={{ flexShrink: 0 }}>{doc.questionsCount}</span>
                    )}
                  </div>
                  {!doc.isShared && doc.status === "uploaded" && (
                    <div 
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      style={{ cursor: 'default', flexShrink: 0 }}
                    >
                      <ShareDocumentButton 
                        documentId={doc.id}
                        onShareCreated={onRefresh}
                        onShareRevoked={onRefresh}
                      />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, color: '#6e7787', fontSize: 13 }}>
                  {loadingDocumentId === doc.id ? (
                    <span>{t("documentList.loading")}</span>
                  ) : doc.status === "uploaded" ? (
                    <>
                      <span>{t("documentList.sizeLabel")} {formatFileSize(doc.sizeBytes)}</span>
                      <span>{t("documentList.modifiedLabel")} {formatDate(doc.createdAt)}</span>
                    </>
                  ) : (
                    <span>{t("documentList.loading")}</span>
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
                <th>{t("documentList.name")}</th>
                <th>{t("documentList.size")}</th>
                <th>{t("documentList.lastModified")}</th>
                <th>{t("documentList.questions")}</th>
                <th style={{ width: 100 }}>{t("documentList.share")}</th>
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
                    <div className="document-name-cell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <div className="document-icon-container">
                          <PageBadge currentPage={doc.lastViewedPage} />
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
                        </div>
                        <span className="document-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {doc.title || t("documentList.untitledDocument")}
                        </span>
                      </div>
                      {(doc.isShared || doc.hasActiveShare) && (
                        <span style={{ 
                          fontSize: 11, 
                          color: '#6B7280', 
                          backgroundColor: '#F3F4F6', 
                          padding: '2px 6px', 
                          borderRadius: 4,
                          flexShrink: 0
                        }}>
                          {t("documentList.shared")}
                        </span>
                      )}
                      {doc.status === 'uploaded' && <CacheBadge documentId={doc.id} />}
                    </div>
                  </td>
                  <td className="document-size">
                    {loadingDocumentId === doc.id ? t("documentList.loading") : (doc.status === "uploaded" ? formatFileSize(doc.sizeBytes) : t("documentList.loading"))}
                  </td>
                  <td className="document-date">
                    {loadingDocumentId === doc.id ? t("documentList.loading") : (doc.status === "uploaded" ? formatDate(doc.createdAt) : t("documentList.loading"))}
                  </td>
                  <td>
                    {doc.status === "uploaded" && doc.questionsCount !== undefined && doc.questionsCount > 0 && (
                      <span className="document-questions-badge">{doc.questionsCount}</span>
                    )}
                  </td>
                  <td
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ cursor: 'default' }}
                  >
                    {/* Show share button only for owned documents (not shared from others) */}
                    {!doc.isShared && doc.status === "uploaded" && (
                      <ShareDocumentButton 
                        documentId={doc.id}
                        onShareCreated={onRefresh}
                        onShareRevoked={onRefresh}
                      />
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
