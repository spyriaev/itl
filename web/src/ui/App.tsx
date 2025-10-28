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
      backgroundColor: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        padding: '20px 0',
        marginBottom: 40,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 400,
            color: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <img src="/icons/lucide-FileText-Outlined.svg" alt="" style={{ width: 20, height: 20 }} />
            Innesi Reader
          </h1>
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
              <FileUpload onUploadComplete={handleUploadComplete} />

              {/* Documents Section */}
              <DocumentList 
                refreshTrigger={refreshTrigger} 
                onDocumentClick={handleDocumentClick}
              />
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

