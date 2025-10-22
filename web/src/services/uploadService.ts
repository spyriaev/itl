import { supabase, uploadPdfToStorage } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/**
 * Generate a unique storage key for a file with user ID
 */
function generateStorageKey(userId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${userId}/${timestamp}-${sanitizedFilename}`
}

/**
 * Get current session token
 */
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export interface UploadProgress {
  stage: 'validating' | 'uploading' | 'saving_metadata' | 'complete' | 'error'
  progress: number
  message: string
}

export interface DocumentMetadata {
  id: string
  title: string | null
  storageKey: string
  sizeBytes: number
  mime: string
  status: string
  createdAt: string
}

/**
 * Calculate SHA256 checksum of a file
 */
async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are allowed' }
  }

  // Check file size (200MB limit)
  const maxSize = 200 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 200MB limit' }
  }

  return { valid: true }
}

/**
 * Save document metadata to the backend
 */
async function saveDocumentMetadata(
  title: string,
  storageKey: string,
  sizeBytes: number,
  mime: string,
  checksumSha256: string
): Promise<DocumentMetadata> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      storageKey,
      sizeBytes,
      mime,
      checksumSha256,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to save metadata' }))
    throw new Error(error.error || 'Failed to save metadata')
  }

  return response.json()
}

/**
 * Upload a PDF file with progress tracking
 */
export async function uploadPdfFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<DocumentMetadata> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Stage 1: Validation
    onProgress?.({
      stage: 'validating',
      progress: 0,
      message: 'Validating file...',
    })

    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Stage 2: Upload to storage
    onProgress?.({
      stage: 'uploading',
      progress: 25,
      message: 'Uploading to storage...',
    })

    const storageKey = generateStorageKey(user.id, file.name)
    await uploadPdfToStorage(file, storageKey)

    onProgress?.({
      stage: 'uploading',
      progress: 50,
      message: 'Upload complete, calculating checksum...',
    })

    // Calculate checksum
    const checksum = await calculateChecksum(file)

    // Stage 3: Save metadata
    onProgress?.({
      stage: 'saving_metadata',
      progress: 75,
      message: 'Saving metadata...',
    })

    const title = file.name.replace('.pdf', '')
    const metadata = await saveDocumentMetadata(
      title,
      storageKey,
      file.size,
      file.type,
      checksum
    )

    // Stage 4: Complete
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Upload complete!',
    })

    return metadata
  } catch (error) {
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'Upload failed',
    })
    throw error
  }
}

/**
 * Fetch list of documents from the backend
 */
export async function fetchDocuments(limit: number = 50, offset: number = 0): Promise<DocumentMetadata[]> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents?limit=${limit}&offset=${offset}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch documents')
  }

  return response.json()
}

export interface DocumentViewInfo {
  url: string
  lastViewedPage: number
  title: string
}

/**
 * Get signed URL for viewing a document
 */
export async function getDocumentViewUrl(documentId: string): Promise<DocumentViewInfo> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents/${documentId}/view`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get view URL' }))
    throw new Error(error.error || 'Failed to get view URL')
  }

  return response.json()
}

/**
 * Update viewing progress for a document
 */
export async function updateViewProgress(documentId: string, page: number): Promise<void> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/documents/${documentId}/progress`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ page }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update progress' }))
    throw new Error(error.error || 'Failed to update progress')
  }
}


