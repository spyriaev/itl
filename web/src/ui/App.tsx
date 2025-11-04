import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "../contexts/AuthContext"
import { LandingPage } from "./components/LandingPage"
import { PlansPage } from "./components/PlansPage"
import { LibraryPage } from "./components/LibraryPage"
import { UserProfile } from "./components/UserProfile"
import { SharedDocumentPage } from "./components/SharedDocumentPage"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AuthModal } from "./components/AuthModal"
import { useNetworkStatus } from "../hooks/useNetworkStatus"
import { useEffect } from "react"
import { fetchDocuments } from "../services/uploadService"

// Component to handle sync on reconnect
function SyncOnReconnect() {
  const { isOnline } = useNetworkStatus()
  
  useEffect(() => {
    if (isOnline) {
      // Sync document list when connection is restored
      fetchDocuments().catch(err => {
        console.warn('Failed to sync documents on reconnect:', err)
      })
    }
  }, [isOnline])
  
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
