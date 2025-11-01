import { useState } from "react"
import { AuthProvider, useAuth } from "../contexts/AuthContext"
import { FileUpload } from "./components/FileUpload"
import { DocumentList } from "./components/DocumentList"
import { UserMenu } from "./components/UserMenu"
import { AuthModal } from "./components/AuthModal"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { PdfViewer } from "./components/PdfViewer"
import "./styles/upload-page.css"

type ViewMode = "library" | "reader"

function AppContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("library")
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const { user } = useAuth()

  const handleUploadComplete = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleDocumentClick = (documentId: string) => {
    setCurrentDocumentId(documentId)
    setViewMode("reader")
  }

  const handleCloseReader = () => {
    setCurrentDocumentId(null)
    setViewMode("library")
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="upload-page">
      <header className="upload-header">
        <div className="upload-header-logo">
          <div className="upload-header-logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5.75 21.25H15.45C17.1302 21.25 17.9702 21.25 18.612 20.923C19.1765 20.6354 19.6354 20.1765 19.923 19.612C20.25 18.9702 20.25 18.1302 20.25 16.45V10.9882C20.25 10.2545 20.25 9.88757 20.1671 9.5423C20.0936 9.2362 19.9724 8.94356 19.8079 8.67515C19.6224 8.3724 19.363 8.11297 18.8441 7.59411L15.4059 4.15589C14.887 3.63703 14.6276 3.37761 14.3249 3.19208C14.0564 3.02759 13.7638 2.90638 13.4577 2.83289C13.1124 2.75 12.7455 2.75 12.0118 2.75H9.875H9.25C8.78558 2.75 8.55337 2.75 8.35842 2.77567C7.01222 2.9529 5.9529 4.01222 5.77567 5.35842C5.75 5.55337 5.75 5.78558 5.75 6.25" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13.75 2.75V4.45C13.75 6.13016 13.75 6.97024 14.077 7.61197C14.3646 8.17646 14.8235 8.6354 15.388 8.92302C16.0298 9.25 16.8698 9.25 18.55 9.25H20.25" stroke="white" strokeWidth="1.5" />
              <path d="M9.33687 15.1876L8.67209 17.2136C8.53833 17.6213 7.96167 17.6213 7.82791 17.2136L7.16313 15.1876C7.03098 14.7849 6.71511 14.469 6.31236 14.3369L4.28637 13.6721C3.87872 13.5383 3.87872 12.9617 4.28637 12.8279L6.31236 12.1631C6.71511 12.031 7.03098 11.7151 7.16313 11.3124L7.82791 9.28637C7.96167 8.87872 8.53833 8.87872 8.67209 9.28637L9.33687 11.3124C9.46902 11.7151 9.78489 12.031 10.1876 12.1631L12.2136 12.8279C12.6213 12.9617 12.6213 13.5383 12.2136 13.6721L10.1876 14.3369C9.78489 14.469 9.46902 14.7849 9.33687 15.1876Z" fill="white" />
            </svg>
          </div>
          <h1 className="upload-header-logo-text">Innesi Reader</h1>
        </div>
        <UserMenu />
      </header>

      <main className="upload-main">
        <ProtectedRoute fallback={<AuthModal />}>
          {viewMode === "library" ? (
            <>
              <div className="documents-header">
                <div className="documents-title">
                  All documents
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
                <div className="documents-actions">
                  <button className="icon-button">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                  </button>
                  <button className="icon-button">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="upload-area">
                <FileUpload onUploadComplete={handleUploadComplete} />

                <DocumentList refreshTrigger={refreshTrigger} onDocumentClick={handleDocumentClick} />
              </div>
            </>
          ) : (
            currentDocumentId && <PdfViewer documentId={currentDocumentId} onClose={handleCloseReader} />
          )}
        </ProtectedRoute>
      </main>
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
