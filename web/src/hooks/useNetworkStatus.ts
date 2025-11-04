/**
 * Network Status Hook
 * Provides online/offline status tracking
 */

import { useState, useEffect } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  isOffline: boolean
}

/**
 * Hook to track network status
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    // Set initial state
    setIsOnline(navigator.onLine)

    // Listen for online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    isOffline: !isOnline
  }
}

/**
 * Helper function to check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine
}

