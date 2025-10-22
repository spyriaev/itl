import React, { useState } from 'react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import { UserMenu } from './components/UserMenu'
import { AuthModal } from './components/AuthModal'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PdfViewer } from './components/PdfViewer'

type ViewMode = 'library' | 'reader'

function AppContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('library')
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const { user } = useAuth()

  const handleUploadComplete = () => {
    // Trigger document list refresh
    setRefreshTrigger(prev => prev + 1)
  }

  const handleDocumentClick = (documentId: string) => {
    setCurrentDocumentId(documentId)
    setViewMode('reader')
  }

  const handleCloseReader = () => {
    setCurrentDocumentId(null)
    setViewMode('library')
    // Refresh document list to show updated progress
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F9FAFB',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '20px 0',
        marginBottom: 48,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span>📚</span>
              Innesi Reader
            </h1>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: 14,
              color: '#6B7280',
            }}>
              {viewMode === 'library' ? 'Upload and manage your PDF documents' : 'Reading PDF document'}
            </p>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 24px 48px 24px',
      }}>
        <ProtectedRoute fallback={<AuthModal />}>
          {viewMode === 'library' ? (
            <>
              {/* Upload Section */}
              <section style={{ marginBottom: 48 }}>
                <h2 style={{
                  margin: '0 0 24px 0',
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#111827',
                  textAlign: 'center',
                }}>
                  Upload PDF Document
                </h2>
                <FileUpload onUploadComplete={handleUploadComplete} />
              </section>

              {/* Documents Section */}
              <section>
                <DocumentList 
                  refreshTrigger={refreshTrigger} 
                  onDocumentClick={handleDocumentClick}
                />
              </section>
            </>
          ) : (
            /* Reader Mode - PdfViewer will handle the full screen display */
            currentDocumentId && (
              <PdfViewer 
                documentId={currentDocumentId} 
                onClose={handleCloseReader}
              />
            )
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

