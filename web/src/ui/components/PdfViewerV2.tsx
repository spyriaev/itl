import React, { useState, useEffect } from 'react'
import { Viewer, Worker } from '@react-pdf-viewer/core'
import { getDocumentViewUrl, DocumentViewInfo } from '../../services/uploadService'

// Импортируем стили
import '@react-pdf-viewer/core/lib/styles/index.css'

interface PdfViewerV2Props {
  documentId: string
  onClose: () => void
  preloadedDocumentInfo?: DocumentViewInfo | null
  onRenderComplete?: () => void
}

const PdfViewerV2 = ({ documentId, onClose, preloadedDocumentInfo, onRenderComplete }: PdfViewerV2Props) => {
  const [documentInfo, setDocumentInfo] = useState<DocumentViewInfo | null>(preloadedDocumentInfo || null)
  const [loading, setLoading] = useState<boolean>(!preloadedDocumentInfo)
  const [error, setError] = useState<string | null>(null)

  // Load document info (only if not preloaded)
  useEffect(() => {
    // If documentInfo is already preloaded, use it
    if (preloadedDocumentInfo) {
      setDocumentInfo(preloadedDocumentInfo)
      setLoading(false)
      return
    }

    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)

        const info = await getDocumentViewUrl(documentId)
        setDocumentInfo(info)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [documentId, preloadedDocumentInfo])

  // Call onRenderComplete when document is loaded
  useEffect(() => {
    if (documentInfo?.url && onRenderComplete && !loading) {
      onRenderComplete()
    }
  }, [documentInfo?.url, loading, onRenderComplete])

  if (loading) {
    return (
      <div className="pdf-viewer-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading document...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pdf-viewer-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <div>Error: {error}</div>
        <button onClick={onClose}>Close</button>
      </div>
    )
  }

  if (!documentInfo?.url) {
    return null
  }

  return (
    <div className="pdf-viewer-container" style={{ width: '100%', height: '100vh' }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={documentInfo.url} />
      </Worker>
    </div>
  )
}

export default PdfViewerV2

