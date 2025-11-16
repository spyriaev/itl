import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Viewer, Worker, type PageChangeEvent, type DocumentLoadEvent } from '@react-pdf-viewer/core'
import '@react-pdf-viewer/core/lib/styles/index.css'
import { getDocumentViewUrl, updateViewProgress, type DocumentViewInfo } from '../../services/uploadService'

interface PdfViewerV2Props {
  documentId: string
  preloadedDocumentInfo?: DocumentViewInfo | null
  onReady?: () => void
  onClose?: () => void
}

const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
const BACKGROUND_COLOR = '#ffffff'

export default function PdfViewerV2({ documentId, preloadedDocumentInfo, onReady, onClose }: PdfViewerV2Props) {
  const [documentInfo, setDocumentInfo] = useState<DocumentViewInfo | null>(preloadedDocumentInfo ?? null)
  const [loading, setLoading] = useState<boolean>(!preloadedDocumentInfo)
  const [pdfLoading, setPdfLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(preloadedDocumentInfo?.lastViewedPage ?? 1)
  const [reloadKey, setReloadKey] = useState(0)

  // Используем useLayoutEffect для синхронного обновления перед рендером
  // Это предотвращает моргание при изменении preloadedDocumentInfo
  useLayoutEffect(() => {
    if (preloadedDocumentInfo) {
      // Синхронно устанавливаем состояние перед рендером
      setDocumentInfo(preloadedDocumentInfo)
      setCurrentPage(Math.max(1, preloadedDocumentInfo.lastViewedPage || 1))
      setLoading(false)
      setError(null)
      // PDF еще не загружен, показываем прелоадер
      setPdfLoading(true)
    }
  }, [preloadedDocumentInfo])

  useEffect(() => {
    // Загружаем документ только если нет preloadedDocumentInfo
    if (preloadedDocumentInfo) {
      return // Не загружаем, если уже есть preloadedDocumentInfo
    }

    let isCancelled = false

    async function loadDocument() {
      try {
        setLoading(true)
        setPdfLoading(true)
        setError(null)
        const info = await getDocumentViewUrl(documentId)
        if (!isCancelled) {
          setDocumentInfo(info)
          setCurrentPage(Math.max(1, info.lastViewedPage || 1))
          setLoading(false)
          // PDF еще не загружен, показываем прелоадер
          setPdfLoading(true)
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : 'Не удалось загрузить документ'
          setError(message)
          setLoading(false)
          setPdfLoading(false)
        }
      }
    }

    loadDocument()

    return () => {
      isCancelled = true
    }
  }, [documentId, reloadKey, preloadedDocumentInfo])

  const handleRetry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  const handlePageChange = useCallback(
    (event: PageChangeEvent) => {
      const nextPage = event.currentPage + 1
      setCurrentPage(nextPage)
      updateViewProgress(documentId, nextPage).catch((err) => {
        console.warn('Failed to update progress from PdfViewerV2:', err)
      })
    },
    [documentId]
  )

  const handleDocumentLoad = useCallback(
    (_event: DocumentLoadEvent) => {
      setPdfLoading(false)
      onReady?.()
    },
    [onReady]
  )

  const workerUrl = useMemo(() => WORKER_URL, [])
  const initialPageIndex = Math.max(0, currentPage - 1)

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#ffffff',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #2d66f5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div
          style={{
            color: '#171a1f',
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          Загрузка PDF...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#fff1f2',
          color: '#b91c1c',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Не удалось открыть документ</div>
        <div style={{ fontSize: 14, color: '#7f1d1d' }}>{error}</div>
        <button
          onClick={handleRetry}
          style={{
            padding: '8px 16px',
            borderRadius: 9999,
            border: 'none',
            backgroundColor: '#DC2626',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </div>
    )
  }

  if (!documentInfo) {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
        }}
      />
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: BACKGROUND_COLOR,
        overflow: 'hidden',
      }}
    >
      {pdfLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            zIndex: 1000,
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: '4px solid #f3f4f6',
              borderTop: '4px solid #2d66f5',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div
            style={{
              color: '#171a1f',
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Загрузка PDF...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть документ"
          style={{
            position: 'fixed',
            top: 'calc(16px + env(safe-area-inset-top, 0px))',
            right: 'calc(16px + env(safe-area-inset-right, 0px))',
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.15)',
            transition: 'opacity 0.2s, transform 0.2s, background-color 0.2s',
            padding: 0,
            zIndex: 5000,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#374151"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}
      <Worker workerUrl={workerUrl}>
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
          }}
        >
          <Viewer
            key={`${documentId}-${documentInfo.url}`}
            fileUrl={documentInfo.url}
            initialPage={initialPageIndex}
            onPageChange={handlePageChange}
            onDocumentLoad={handleDocumentLoad}
            enableSmoothScroll={false} 
          />
        </div>
      </Worker>
    </div>
  )
}
