import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LandingHeader } from './LandingHeader'
import { HeroSection } from './HeroSection'
import { FeaturesSection } from './FeaturesSection'
import { LandingFooter } from './LandingFooter'
import { AuthModal } from './AuthModal'
import '../styles/landing.css'
import '../styles/typography.css'

export function LandingPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Redirect if user is already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/app')
    }
  }, [user, loading, navigate])

  const handleTryClick = () => {
    setShowAuthModal(true)
  }

  const handleStartClick = () => {
    setShowAuthModal(true)
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    // Small delay to ensure auth state is updated
    setTimeout(() => {
      navigate('/app')
    }, 100)
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect
  }

  return (
    <>
      <LandingHeader onTryClick={handleTryClick} />
      <HeroSection onStartClick={handleStartClick} />
      <FeaturesSection />
      <LandingFooter />
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />
      )}
    </>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #2d66f5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
}

// Add spinner animation if not already added
if (!document.getElementById('spinner-animation-style')) {
  const spinnerStyle = document.createElement('style')
  spinnerStyle.id = 'spinner-animation-style'
  spinnerStyle.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(spinnerStyle)
}

