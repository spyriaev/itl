import { useEffect } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import PdfViewerV2 from "./PdfViewerV2"
import type { DocumentViewInfo } from "../../services/uploadService"

type DocumentViewerState = {
  preloadedDocumentInfo?: DocumentViewInfo | null
}

export function DocumentViewerPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const preloadedDocumentInfo = (location.state as DocumentViewerState | null)?.preloadedDocumentInfo ?? null

  useEffect(() => {
    if (!documentId) {
      navigate("/app", { replace: true })
    }
  }, [documentId, navigate])

  if (!documentId) {
    return null
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#ffffff",
      }}
    >
      <PdfViewerV2
        documentId={documentId}
        preloadedDocumentInfo={preloadedDocumentInfo}
        onClose={() => navigate("/app")}
      />
    </div>
  )
}