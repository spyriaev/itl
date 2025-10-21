import React, { useState } from 'react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { FileUpload } from './components/FileUpload'
import { DocumentList } from './components/DocumentList'
import { UserMenu } from './components/UserMenu'
import { AuthModal } from './components/AuthModal'
import { ProtectedRoute } from './components/ProtectedRoute'

function AppContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { user } = useAuth()

  const handleUploadComplete = () => {
    // Trigger document list refresh
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
              AI Reader
            </h1>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: 14,
              color: '#6B7280',
            }}>
              Upload and manage your PDF documents
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
            <DocumentList refreshTrigger={refreshTrigger} />
          </section>
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

