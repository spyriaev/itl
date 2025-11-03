import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/**
 * Get current session token
 */
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export interface ShareDocumentResponse {
  shareToken: string
  shareUrl: string
  createdAt: string
  expiresAt?: string | null
}

export interface ShareStatusResponse {
  hasActiveShare: boolean
  shareToken?: string | null
  shareUrl?: string | null
  createdAt?: string | null
  revokedAt?: string | null
  expiresAt?: string | null
}

export interface SharedDocumentInfo {
  id: string
  title: string | null
  sizeBytes: number | null
  mime: string | null
  createdAt: string
}

export interface SharedDocumentAccess {
  url: string
  lastViewedPage: number
  title: string
  documentId: string
}

/**
 * Create a share link for a document
 */
export async function createShareLink(
  documentId: string,
  expiresAt?: string
): Promise<ShareDocumentResponse> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents/${documentId}/share`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expiresAt: expiresAt || null,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create share link' }))
    throw new Error(error.detail || 'Failed to create share link')
  }

  return response.json()
}

/**
 * Get share status for a document
 */
export async function getShareStatus(documentId: string): Promise<ShareStatusResponse> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents/${documentId}/share`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get share status' }))
    throw new Error(error.detail || 'Failed to get share status')
  }

  return response.json()
}

/**
 * Revoke a share link for a document
 */
export async function revokeShareLink(documentId: string): Promise<void> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents/${documentId}/share`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to revoke share link' }))
    throw new Error(error.detail || 'Failed to revoke share link')
  }
}

/**
 * Get document information by share token (no auth required)
 */
export async function getSharedDocumentInfo(token: string): Promise<SharedDocumentInfo> {
  const response = await fetch(`${API_URL}/api/documents/shared/${token}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Share not found or expired' }))
    throw new Error(error.detail || 'Share not found or expired')
  }

  return response.json()
}

/**
 * Get access to a shared document (requires auth, records access)
 */
export async function getSharedDocumentAccess(token: string): Promise<SharedDocumentAccess> {
  const authToken = await getAuthToken()
  if (!authToken) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents/shared/${token}/access`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get access' }))
    throw new Error(error.detail || 'Failed to get access')
  }

  return response.json()
}

