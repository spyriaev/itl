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
      <div style={styles.userInfo}>
        <div style={styles.email}>{user.email}</div>
      </div>
      <img src="/icons/lucide-HardDrive-Outlined.svg" alt="" style={{ width: 36, height: 36 }} />
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  email: {
    fontSize: '14px',
    color: '#3B82F6',
    fontWeight: '400',
  },
}


