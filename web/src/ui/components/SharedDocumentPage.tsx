"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../../contexts/AuthContext"
import { PdfViewer } from "./PdfViewer"
import { getSharedDocumentAccess, type SharedDocumentAccess } from "../../services/shareService"
import { pdfjs } from 'react-pdf'
import "../styles/upload-page.css"
import "../styles/typography.css"

export function SharedDocumentPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documentAccess, setDocumentAccess] = useState<SharedDocumentAccess | null>(null)
  const [isPdfReady, setIsPdfReady] = useState<boolean>(false)

  // Configure PDF.js worker
  useEffect(() => {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }, [])

  // Load document when token is available and user is authenticated
  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!token) {
      setError(t("sharedDocument.invalidToken"))
      setLoading(false)
      return
    }

    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get access to shared document (this records the access)
        const access = await getSharedDocumentAccess(token)
        setDocumentAccess(access)
        
        // Preload PDF
        const loadingTask = pdfjs.getDocument({ url: access.url })
        await loadingTask.promise
        
        setIsPdfReady(true)
      } catch (err) {
        console.error('[SharedDocumentPage] Failed to load document:', err)
        setError(err instanceof Error ? err.message : t("sharedDocument.errorLoading"))
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [token, user, authLoading, t])

  // Redirect to login if not authenticated (handled by ProtectedRoute, but just in case)
  if (!authLoading && !user) {
    return null  // ProtectedRoute will handle this
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>{t("sharedDocument.loading")}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>{t("sharedDocument.error")}</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate('/app')}
            style={styles.button}
          >
            {t("sharedDocument.backToLibrary")}
          </button>
        </div>
      </div>
    )
  }

  if (!documentAccess) {
    return null
  }

  return (
    <PdfViewer
      documentId={documentAccess.documentId}
      onClose={() => navigate('/app')}
      preloadedDocumentInfo={{
        url: documentAccess.url,
        lastViewedPage: documentAccess.lastViewedPage,
        title: documentAccess.title
      }}
      onRenderComplete={() => setIsPdfReady(true)}
    />
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  loading: {
    textAlign: 'center',
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #171A1F',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
  error: {
    textAlign: 'center',
    maxWidth: '500px',
  },
  button: {
    marginTop: '20px',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#171A1F',
    color: 'white',
    fontSize: '14px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '600',
    cursor: 'pointer',
  },
}

