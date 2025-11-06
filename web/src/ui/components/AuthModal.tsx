import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import '../styles/buttons.css'
import '../styles/typography.css'

interface AuthModalProps {
  onClose?: () => void
  onAuthSuccess?: () => void
}

export function AuthModal({ onClose, onAuthSuccess }: AuthModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredGoogle, setHoveredGoogle] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()

  // Call onAuthSuccess when user becomes authenticated
  React.useEffect(() => {
    if (user && onAuthSuccess) {
      // Reset loading state
      setLoading(false)
      // Close modal first, then call success callback
      if (onClose) {
        onClose()
      }
      // Small delay to ensure modal closes before redirect
      setTimeout(() => {
        onAuthSuccess()
      }, 100)
    }
  }, [user, onAuthSuccess, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = mode === 'signin' 
        ? await signIn(email, password)
        : await signUp(email, password)

      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        if (mode === 'signup') {
          setError(t("authModal.signUpSuccess"))
          setLoading(false)
        } else {
          // Wait for user to be set via auth state change
          // onAuthSuccess will be called via useEffect when user is set
          // Keep loading true until user is set
        }
      }
    } catch (err) {
      setError(t("authModal.unexpectedError"))
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)
    
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError(t("authModal.googleSignInFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} data-auth-modal>
        <div style={styles.header}>
          <h2 className="text-heading-small">
            {mode === 'signin' ? t("authModal.signIn") : t("authModal.signUp")}
          </h2>
          {onClose && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={styles.closeButton}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(mode === 'signin' ? styles.tabActive : {}),
            }}
            onClick={() => setMode('signin')}
            disabled={loading}
          >
            {t("authModal.signIn")}
          </button>
          <button
            style={{
              ...styles.tab,
              ...(mode === 'signup' ? styles.tabActive : {}),
            }}
            onClick={() => setMode('signup')}
            disabled={loading}
          >
            {t("authModal.signUp")}
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t("authModal.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              disabled={loading}
              placeholder={t("authModal.emailPlaceholder")}
              onBlur={(e) => {
                // Reset zoom on iOS after input loses focus
                if (window.visualViewport && window.visualViewport.scale !== 1) {
                  window.scrollTo(0, 0)
                }
              }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t("authModal.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              disabled={loading}
              placeholder={t("authModal.passwordPlaceholder")}
              minLength={6}
              onBlur={(e) => {
                // Reset zoom on iOS after input loses focus
                if (window.visualViewport && window.visualViewport.scale !== 1) {
                  window.scrollTo(0, 0)
                }
              }}
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="button-primary"
            disabled={loading}
          >
            {loading ? t("authModal.loading") : mode === 'signin' ? t("authModal.signIn") : t("authModal.signUp")}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>{t("authModal.or")}</span>
        </div>

        <button
          onClick={handleGoogleSignIn}
          style={{
            ...styles.googleButton,
            ...(hoveredGoogle ? styles.googleButtonHover : {}),
          }}
          onMouseEnter={() => setHoveredGoogle(true)}
          onMouseLeave={() => setHoveredGoogle(false)}
          disabled={loading}
        >
          <svg style={styles.googleIcon} viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t("authModal.continueWithGoogle")}
        </button>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '28px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    position: 'relative',
  },
  header: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
    lineHeight: 0,
    color: '#6b7280',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '2px solid #e5e7eb',
  },
  tab: {
    flex: 1,
    padding: '12px',
    border: 'none',
    background: 'none',
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#565E6C',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    transition: 'all 0.2s',
  },
  tabActive: {
    fontWeight: '700',
    color: '#171A1F',
    borderBottomColor: '#171A1F',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#323842',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '16px', // 16px minimum to prevent iOS zoom on focus
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#323842',
    transition: 'border-color 0.2s',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '14px',
  },
  divider: {
    position: 'relative',
    margin: '24px 0',
    textAlign: 'center',
  },
  dividerText: {
    backgroundColor: 'white',
    padding: '0 12px',
    color: '#6b7280',
    fontSize: '14px',
    position: 'relative',
    zIndex: 1,
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: 'white',
    fontSize: '16px',
    fontWeight: '500',
    color: '#374151',
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  googleButtonHover: {
    backgroundColor: '#f9fafb',
    borderColor: '#9ca3af',
  },
  googleIcon: {
    width: '20px',
    height: '20px',
  },
}

// Add divider line and responsive styles
const dividerStyle = document.createElement('style')
dividerStyle.textContent = `
  input:focus {
    outline: none;
    border-color: #2d66f5;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  @media (max-width: 768px) {
    [data-auth-modal] {
      max-width: 360px !important;
      padding: 20px !important;
    }
    [data-auth-modal] h2 {
      font-size: 20px !important;
    }
    [data-auth-modal] input {
      font-size: 16px !important; /* 16px minimum to prevent iOS zoom */
    }
    [data-auth-modal] button {
      font-size: 14px !important;
    }
  }
  @media (max-width: 480px) {
    [data-auth-modal] {
      max-width: 320px !important;
      padding: 16px !important;
    }
    [data-auth-modal] h2 {
      font-size: 18px !important;
    }
    [data-auth-modal] input {
      font-size: 16px !important; /* 16px minimum to prevent iOS zoom */
    }
  }
`
document.head.appendChild(dividerStyle)
