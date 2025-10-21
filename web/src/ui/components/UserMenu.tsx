import React from 'react'
import { useAuth } from '../../contexts/AuthContext'

export function UserMenu() {
  const { user, signOut } = useAuth()

  if (!user) return null

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div style={styles.container}>
      <div style={styles.avatar}>
        {getInitials(user.email || 'U')}
      </div>
      <div style={styles.info}>
        <div style={styles.email}>{user.email}</div>
        <button onClick={handleSignOut} style={styles.signOutButton}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  email: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  signOutButton: {
    padding: '4px 8px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    backgroundColor: 'white',
    fontSize: '12px',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
}

// Add hover styles
const hoverStyle = document.createElement('style')
hoverStyle.textContent = `
  button:hover {
    background-color: #f9fafb !important;
    border-color: #9ca3af !important;
  }
`
document.head.appendChild(hoverStyle)


