import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "../contexts/AuthContext"
import { LandingPage } from "./components/LandingPage"
import { PlansPage } from "./components/PlansPage"
import { LibraryPage } from "./components/LibraryPage"
import { UserProfile } from "./components/UserProfile"
import { SharedDocumentPage } from "./components/SharedDocumentPage"
import { DocumentViewerPage } from "./components/DocumentViewerPage"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AuthModal } from "./components/AuthModal"
import { useNetworkStatus } from "../hooks/useNetworkStatus"
import { useEffect } from "react"
import { fetchDocuments } from "../services/uploadService"

// Component to handle sync on reconnect
function SyncOnReconnect() {
  const { isOnline } = useNetworkStatus()
  const { user, loading } = useAuth()
  
  useEffect(() => {
    // Only sync if online, authenticated, and not loading
    if (isOnline && user && !loading) {
      // Sync document list when connection is restored
      fetchDocuments().catch(err => {
        // Only log if it's not an authentication error (which is expected when not authenticated)
        if (!err.message?.includes('Not authenticated')) {
          console.warn('Failed to sync documents on reconnect:', err)
        }
      })
    }
  }, [isOnline, user, loading])
  
  return null
}

export function App() {
  return (
    <AuthProvider>
      <SyncOnReconnect />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute fallback={<AuthModal />}>
              <LibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/document/:documentId"
          element={
            <ProtectedRoute fallback={<AuthModal />}>
              <DocumentViewerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute fallback={<AuthModal />}>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/share/:token"
          element={
            <ProtectedRoute fallback={<AuthModal />}>
              <SharedDocumentPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
