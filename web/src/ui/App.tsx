"use client"

import { useState } from "react"
import { AuthProvider, useAuth } from "../contexts/AuthContext"
import { FileUpload } from "./components/FileUpload"
import { DocumentList } from "./components/DocumentList"
import { UserMenu } from "./components/UserMenu"
import { AuthModal } from "./components/AuthModal"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { PdfViewer } from "./components/PdfViewer"

type ViewMode = "library" | "reader"

function AppContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("library")
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const { user } = useAuth()

  const handleUploadComplete = () => {
    // Trigger document list refresh
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleDocumentClick = (documentId: string) => {
    setCurrentDocumentId(documentId)
    setViewMode("reader")
  }

  const handleCloseReader = () => {
    setCurrentDocumentId(null)
    setViewMode("library")
    // Refresh document list to show updated progress
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <header
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #dee1e6",
          padding: "16px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                backgroundColor: "#2d66f5",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
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
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 400,
                color: "#2d66f5",
              }}
            >
              Innesi Reader
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "48px 32px",
        }}
      >
        <ProtectedRoute fallback={<AuthModal />}>
          {viewMode === "library" ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 32,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 32,
                      fontWeight: 400,
                      color: "#171a1f",
                    }}
                  >
                    All documents
                  </h2>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#171a1f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                  }}
                >
                  <button
                    style={{
                      width: 40,
                      height: 40,
                      border: "1px solid #dee1e6",
                      borderRadius: 8,
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#565e6c"
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
                  <button
                    style={{
                      width: 40,
                      height: 40,
                      border: "1px solid #dee1e6",
                      borderRadius: 8,
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#565e6c"
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

              {/* Upload Section */}
              <FileUpload onUploadComplete={handleUploadComplete} />

              {/* Documents Section */}
              <DocumentList refreshTrigger={refreshTrigger} onDocumentClick={handleDocumentClick} />
            </>
          ) : (
            /* Reader Mode - PdfViewer will handle the full screen display */
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
