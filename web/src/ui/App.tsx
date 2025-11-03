import { Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "../contexts/AuthContext"
import { LandingPage } from "./components/LandingPage"
import { PlansPage } from "./components/PlansPage"
import { LibraryPage } from "./components/LibraryPage"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AuthModal } from "./components/AuthModal"

export function App() {
  return (
    <AuthProvider>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
