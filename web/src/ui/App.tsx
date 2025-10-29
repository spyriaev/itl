"use client"

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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
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

              <FileUpload onUploadComplete={handleUploadComplete} />

              <DocumentList refreshTrigger={refreshTrigger} onDocumentClick={handleDocumentClick} />
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
