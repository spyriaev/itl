"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { createShareLink, revokeShareLink, getShareStatus, type ShareStatusResponse } from "../../services/shareService"

interface ShareDocumentButtonProps {
  documentId: string
  onShareCreated?: () => void
  onShareRevoked?: () => void
  renderTrigger?: (helpers: {
    open: () => void
    loading: boolean
    isShared: boolean
    hasError: boolean
  }) => React.ReactNode
  onExposeOpen?: (openFn: (() => void) | null) => void
}

export function ShareDocumentButton({ documentId, onShareCreated, onShareRevoked, renderTrigger, onExposeOpen }: ShareDocumentButtonProps) {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shareStatus, setShareStatus] = useState<ShareStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)

  const loadShareStatus = async () => {
    // Prevent multiple simultaneous loads
    if (isLoadingStatus) return
    
    try {
      setIsLoadingStatus(true)
      setError(null)
      const status = await getShareStatus(documentId)
      setShareStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shareDocument.errorLoading"))
      setShareStatus(null)
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const handleCreateShare = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await createShareLink(documentId)
      const newStatus: ShareStatusResponse = {
        hasActiveShare: true,
        shareToken: response.shareToken,
        shareUrl: response.shareUrl,
        createdAt: response.createdAt,
        expiresAt: response.expiresAt,
      }
      setShareStatus(newStatus)
      if (onShareCreated) {
        onShareCreated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shareDocument.errorCreating"))
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeShare = async () => {
    try {
      setLoading(true)
      setError(null)
      await revokeShareLink(documentId)
      const newStatus: ShareStatusResponse = {
        hasActiveShare: false,
      }
      setShareStatus(newStatus)
      if (onShareRevoked) {
        onShareRevoked()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shareDocument.errorRevoking"))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareStatus?.shareUrl) return

    try {
      await navigator.clipboard.writeText(shareStatus.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(t("shareDocument.errorCopying"))
    }
  }

  const handleOpenModal = useCallback(async () => {
    setIsModalOpen(true)
    // Load status only if not already loaded
    if (!shareStatus) {
      await loadShareStatus()
    }
  }, [shareStatus, loadShareStatus])

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setError(null)
    setCopied(false)
    // Don't clear shareStatus to prevent flickering on reopen
  }

  useEffect(() => {
    if (!onExposeOpen) {
      return
    }
    onExposeOpen(handleOpenModal)
    return () => {
      onExposeOpen(null)
    }
  }, [handleOpenModal, onExposeOpen])

  const triggerProps = {
    open: () => {
      handleOpenModal()
    },
    loading,
    isShared: !!shareStatus?.hasActiveShare,
    hasError: !!error
  }

  const defaultTrigger = (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleOpenModal()
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseUp={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          handleOpenModal()
        }
      }}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6B7280',
        borderRadius: '4px',
        transition: 'all 0.2s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F3F4F6'
        e.currentTarget.style.color = '#171A1F'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.color = '#6B7280'
      }}
      title={t("shareDocument.share")}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    </div>
  )

  return (
    <>
      {renderTrigger ? renderTrigger(triggerProps) : defaultTrigger}

      {isModalOpen && (
        <div style={styles.overlay} onClick={handleCloseModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h2 className="text-heading-small">{t("shareDocument.title")}</h2>
              <button
                type="button"
                aria-label={t("shareDocument.close")}
                onClick={handleCloseModal}
                style={styles.closeButton}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div style={styles.content}>
              {isLoadingStatus && !shareStatus && (
                <div style={styles.loading}>
                  <p>{t("shareDocument.loading")}</p>
                </div>
              )}

              {error && (
                <div style={styles.error}>
                  <p>{error}</p>
                </div>
              )}

              {!isLoadingStatus && shareStatus?.hasActiveShare ? (
                <div style={styles.shareActive}>
                  <div style={styles.shareUrlContainer}>
                    <input
                      type="text"
                      value={shareStatus.shareUrl || ''}
                      readOnly
                      style={styles.shareUrlInput}
                    />
                    <button
                      onClick={handleCopyLink}
                      style={styles.copyButton}
                      disabled={loading || copied}
                    >
                      {copied ? t("shareDocument.copied") : t("shareDocument.copy")}
                    </button>
                  </div>
                  <button
                    onClick={handleRevokeShare}
                    disabled={loading}
                    style={{
                      ...styles.revokeButton,
                      opacity: loading ? 0.6 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                    type="button"
                  >
                    {loading ? t("shareDocument.revoking") : t("shareDocument.revoke")}
                  </button>
                </div>
              ) : !isLoadingStatus ? (
                <div style={styles.shareInactive}>
                  <p style={styles.description}>{t("shareDocument.description")}</p>
                  <button
                    onClick={handleCreateShare}
                    disabled={loading}
                    style={{
                      ...styles.createButton,
                      opacity: loading ? 0.6 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                    type="button"
                  >
                    {loading ? t("shareDocument.creating") : t("shareDocument.createLink")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '28px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    position: 'relative',
  },
  header: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
    lineHeight: 0,
    color: '#6b7280',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#6b7280',
  },
  error: {
    padding: '12px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    color: '#DC2626',
    fontSize: '14px',
  },
  shareActive: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  shareUrlContainer: {
    display: 'flex',
    gap: '8px',
  },
  shareUrlInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    backgroundColor: '#F9FAFB',
    color: '#323842',
  },
  copyButton: {
    padding: '10px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: 'white',
    color: '#323842',
    fontSize: '14px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.2s',
  },
  revokeButton: {
    padding: '10px 16px',
    border: '1px solid #DC2626',
    borderRadius: '6px',
    backgroundColor: 'white',
    color: '#DC2626',
    fontSize: '14px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  shareInactive: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  description: {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#6b7280',
    margin: 0,
  },
  createButton: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#171A1F',
    color: 'white',
    fontSize: '14px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
}

