import { supabase, uploadPdfToStorage } from '../lib/supabase'
import { extractDocumentStructure } from './documentService'
import { getPdfFromCache, savePdfToCache, initCache } from './pdfCache'
import { cacheDocumentList, getCachedDocumentList, initDocumentListCache } from './documentListCache'
import { isOnline } from '../hooks/useNetworkStatus'

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
  lastViewedPage?: number | null
  isShared?: boolean  // Whether this document is shared (not owned by current user)
  hasActiveShare?: boolean  // Whether this document has an active share link (created by current user)
  questionsCount?: number  // Number of questions asked for this document
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

    // Stage 4: Extract document structure
    onProgress?.({
      stage: 'complete',
      progress: 85,
      message: 'Extracting document structure...',
    })

    // Extract document structure from PDF
    try {
      await extractDocumentStructure(metadata.id, false)
    } catch (structureError) {
      console.error('Failed to extract document structure:', structureError)
      // Don't fail the upload if structure extraction fails
    }

    // Stage 5: Complete
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
 * Uses cache when offline, syncs with server when online
 */
export async function fetchDocuments(limit: number = 50, offset: number = 0): Promise<DocumentMetadata[]> {
  // Initialize cache
  await initDocumentListCache()
  
  // Try to load from cache first
  const cachedDocuments = await getCachedDocumentList()
  
  // If offline, return cached documents
  if (!isOnline()) {
    if (cachedDocuments.length > 0) {
      console.log('[fetchDocuments] Offline, using cached documents')
      return cachedDocuments.slice(offset, offset + limit)
    }
    throw new Error('No cached documents available and offline')
  }
  
  // Online: try to fetch from server
  try {
    const token = await getAuthToken()
    if (!token) {
      // If not authenticated but we have cache, use cache silently
      if (cachedDocuments.length > 0) {
        return cachedDocuments.slice(offset, offset + limit)
      }
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

    const documents = await response.json()
    
    // Cache the documents
    await cacheDocumentList(documents)
    
    return documents
  } catch (error) {
    // If fetch fails but we have cache, use cache
    if (cachedDocuments.length > 0) {
      // Only log warning if it's not an authentication error (which is expected when not authenticated)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('Not authenticated')) {
        console.warn('[fetchDocuments] Failed to fetch from server, using cache:', error)
      }
      return cachedDocuments.slice(offset, offset + limit)
    }
    throw error
  }
}

export interface DocumentViewInfo {
  url: string
  lastViewedPage: number
  title: string
}

/**
 * Get signed URL for viewing a document
 * Checks cache first, then loads from server if not cached
 */
export async function getDocumentViewUrl(documentId: string): Promise<DocumentViewInfo> {
  // Initialize cache
  await initCache()

  // Check cache first
  const cached = await getPdfFromCache(documentId)
  if (cached) {
    console.log(`[getDocumentViewUrl] Using cached PDF for document ${documentId}`)
    
    // Get metadata from server to get lastViewedPage and title
    const token = await getAuthToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await fetch(`${API_URL}/api/documents/${documentId}/view`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const metadata = await response.json()
        // Return cached blob URL with metadata from server
        return {
          url: cached.url,
          lastViewedPage: metadata.lastViewedPage,
          title: metadata.title
        }
      }
    } catch (error) {
      console.warn('[getDocumentViewUrl] Failed to fetch metadata, using cached URL only:', error)
      // Fallback: return cached URL with default values
      return {
        url: cached.url,
        lastViewedPage: 1,
        title: ''
      }
    }
  }

  // Not in cache, fetch from server
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

  const viewInfo = await response.json()

  // Download PDF blob and cache it
  try {
    console.log(`[getDocumentViewUrl] Downloading PDF for caching: ${documentId}`)
    const pdfResponse = await fetch(viewInfo.url)
    if (pdfResponse.ok) {
      const blob = await pdfResponse.blob()
      
      // Save to cache asynchronously (don't block return)
      savePdfToCache(documentId, blob, viewInfo.url).catch((error) => {
        console.warn('[getDocumentViewUrl] Failed to cache PDF:', error)
      })
      
      // Create blob URL for immediate use
      const blobUrl = URL.createObjectURL(blob)
      return {
        url: blobUrl,
        lastViewedPage: viewInfo.lastViewedPage,
        title: viewInfo.title
      }
    } else {
      console.warn('[getDocumentViewUrl] Failed to download PDF for caching')
    }
  } catch (error) {
    console.warn('[getDocumentViewUrl] Error caching PDF, using original URL:', error)
  }

  // Return original signed URL if caching failed
  return viewInfo
}

/**
 * Get document metadata by ID from the documents list
 */
async function getDocumentById(documentId: string): Promise<DocumentMetadata | null> {
  try {
    const documents = await fetchDocuments(100, 0)
    const document = documents.find(doc => doc.id === documentId) || null
    console.log(`[waitForDocumentUpload] Looking for document ${documentId}, found:`, document ? { id: document.id, status: document.status } : 'not found')
    return document
  } catch (error) {
    console.error('[waitForDocumentUpload] Error fetching documents:', error)
    return null
  }
}

/**
 * Wait for document to be uploaded (status === "uploaded")
 */
export async function waitForDocumentUpload(documentId: string, maxAttempts: number = 30, intervalMs: number = 1000): Promise<DocumentMetadata> {
  console.log(`[waitForDocumentUpload] Starting to wait for document ${documentId}`, { maxAttempts, intervalMs })
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const document = await getDocumentById(documentId)
      
      if (document) {
        const status = document.status?.toLowerCase() || ""
        console.log(`[waitForDocumentUpload] Attempt ${attempt + 1}: Found document with status "${document.status}" (normalized: "${status}")`)
        if (status === "uploaded") {
          console.log(`[waitForDocumentUpload] Document is uploaded, returning`)
          return document
        }
      } else {
        console.log(`[waitForDocumentUpload] Attempt ${attempt + 1}: Document not found in list yet`)
      }
      
      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    } catch (error) {
      console.error(`[waitForDocumentUpload] Attempt ${attempt + 1} error:`, error)
      // If error, wait and retry (except on last attempt)
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    }
  }
  
  console.error(`[waitForDocumentUpload] Timeout waiting for document ${documentId} after ${maxAttempts} attempts`)
  throw new Error('Document upload timeout')
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
