import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'

interface AuthModalProps {
  onClose?: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredSubmit, setHoveredSubmit] = useState(false)
  const [hoveredGoogle, setHoveredGoogle] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()

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
      } else {
        if (mode === 'signup') {
          setError(t("authModal.signUpSuccess"))
        } else if (onClose) {
          onClose()
        }
      }
    } catch (err) {
      setError(t("authModal.unexpectedError"))
    } finally {
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
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {mode === 'signin' ? t("authModal.signIn") : t("authModal.signUp")}
          </h2>
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
            />
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.submitButton,
              ...(hoveredSubmit ? styles.submitButtonHover : {}),
            }}
            onMouseEnter={() => setHoveredSubmit(true)}
            onMouseLeave={() => setHoveredSubmit(false)}
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
    padding: '32px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1a1a1a',
    margin: 0,
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
    fontSize: '16px',
    fontWeight: '500',
    color: '#6b7280',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6',
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
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '16px',
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
  submitButton: {
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
  },
  submitButtonHover: {
    backgroundColor: '#1d4ed8 !important',
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)',
    color: 'white !important',
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

// Add divider line using ::before pseudo-element effect
const dividerStyle = document.createElement('style')
dividerStyle.textContent = `
  input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  button[type="submit"]:hover:not(:disabled) {
    background-color: #1d4ed8 !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4) !important;
    color: white !important;
  }
`
document.head.appendChild(dividerStyle)
