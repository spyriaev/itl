/**
 * Document List Cache Service
 * Provides IndexedDB caching for document list metadata
 * to enable offline mode and cross-device synchronization
 */

import type { DocumentMetadata } from './uploadService'

const DB_NAME = 'document_list_cache_db'
const DB_VERSION = 2  // Incremented to add sync fields
const STORE_DOCUMENTS = 'documents'

interface CachedDocumentMetadata extends DocumentMetadata {
  cachedAt: string  // ISO timestamp
  lastSync?: string  // ISO timestamp for questions sync
  lastModified?: string  // ISO timestamp from server for questions
  version?: number  // Version for questions cache
}

let db: IDBDatabase | null = null
let isInitialized = false

/**
 * Initialize IndexedDB
 */
async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      
      // Create object store if it doesn't exist
      if (!database.objectStoreNames.contains(STORE_DOCUMENTS)) {
        const docStore = database.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' })
        docStore.createIndex('createdAt', 'createdAt', { unique: false })
        docStore.createIndex('cachedAt', 'cachedAt', { unique: false })
        docStore.createIndex('lastSync', 'lastSync', { unique: false })
      } else {
        // Migration: add indexes for sync fields if they don't exist
        const docStore = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_DOCUMENTS)
        if (docStore && !docStore.indexNames.contains('lastSync')) {
          docStore.createIndex('lastSync', 'lastSync', { unique: false })
        }
      }
    }
  })
}

/**
 * Initialize cache
 */
export async function initDocumentListCache(): Promise<void> {
  if (isInitialized) return

  try {
    await initIndexedDB()
    isInitialized = true
    console.log('Document list cache initialized successfully')
  } catch (error) {
    console.error('Failed to initialize document list cache:', error)
    // Continue without cache (graceful degradation)
  }
}

/**
 * Cache document list
 */
export async function cacheDocumentList(documents: DocumentMetadata[]): Promise<void> {
  try {
    await initDocumentListCache()
    if (!db) return

    const transaction = db.transaction([STORE_DOCUMENTS], 'readwrite')
    const store = transaction.objectStore(STORE_DOCUMENTS)
    
    // Clear old cache
    await new Promise<void>((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    
    // Add new documents with cache timestamp
    const cachedAt = new Date().toISOString()
    for (const doc of documents) {
      const cached: CachedDocumentMetadata = {
        ...doc,
        cachedAt
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cached)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  } catch (error) {
    console.error('Error caching document list:', error)
  }
}

/**
 * Get cached document list
 */
export async function getCachedDocumentList(): Promise<DocumentMetadata[]> {
  try {
    await initDocumentListCache()
    if (!db) return []

    const transaction = db.transaction([STORE_DOCUMENTS], 'readonly')
    const store = transaction.objectStore(STORE_DOCUMENTS)
    
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const cached = request.result as CachedDocumentMetadata[] || []
        // Remove cache-specific fields
        const documents = cached.map(({ cachedAt, ...doc }) => doc)
        // Sort by createdAt descending (most recent first)
        documents.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        resolve(documents)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting cached document list:', error)
    return []
  }
}

/**
 * Get cached document by ID
 */
export async function getCachedDocumentById(documentId: string): Promise<DocumentMetadata | null> {
  try {
    await initDocumentListCache()
    if (!db) return null

    const transaction = db.transaction([STORE_DOCUMENTS], 'readonly')
    const store = transaction.objectStore(STORE_DOCUMENTS)
    
    return new Promise((resolve, reject) => {
      const request = store.get(documentId)
      request.onsuccess = () => {
        const cached = request.result as CachedDocumentMetadata | undefined
        if (cached) {
          const { cachedAt, ...doc } = cached
          resolve(doc)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting cached document:', error)
    return null
  }
}

/**
 * Update document sync metadata (for questions synchronization)
 */
export async function updateDocumentSyncMetadata(
  documentId: string,
  lastSync: string,
  lastModified: string
): Promise<void> {
  try {
    await initDocumentListCache()
    if (!db) return

    const transaction = db.transaction([STORE_DOCUMENTS], 'readwrite')
    const store = transaction.objectStore(STORE_DOCUMENTS)
    
    // Get existing document
    const existing = await new Promise<CachedDocumentMetadata | undefined>((resolve, reject) => {
      const request = store.get(documentId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (existing) {
      // Update sync fields
      const updated: CachedDocumentMetadata = {
        ...existing,
        lastSync,
        lastModified,
        version: (existing.version || 0) + 1
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(updated)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } else {
      // Create minimal entry if document doesn't exist in cache
      const minimal: CachedDocumentMetadata = {
        id: documentId,
        title: '',
        createdAt: new Date().toISOString(),
        status: 'uploaded',
        cachedAt: new Date().toISOString(),
        lastSync,
        lastModified,
        version: 1
      } as CachedDocumentMetadata
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(minimal)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  } catch (error) {
    console.error('Error updating document sync metadata:', error)
  }
}

/**
 * Get document sync metadata (for questions synchronization)
 */
export async function getDocumentSyncMetadata(documentId: string): Promise<{
  lastSync?: string
  lastModified?: string
  version?: number
} | null> {
  try {
    await initDocumentListCache()
    if (!db) return null

    const transaction = db.transaction([STORE_DOCUMENTS], 'readonly')
    const store = transaction.objectStore(STORE_DOCUMENTS)
    
    return new Promise((resolve, reject) => {
      const request = store.get(documentId)
      request.onsuccess = () => {
        const cached = request.result as CachedDocumentMetadata | undefined
        if (cached && (cached.lastSync || cached.lastModified)) {
          resolve({
            lastSync: cached.lastSync,
            lastModified: cached.lastModified,
            version: cached.version
          })
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting document sync metadata:', error)
    return null
  }
}

/**
 * Clear document list cache
 */
export async function clearDocumentListCache(): Promise<void> {
  try {
    await initDocumentListCache()
    if (!db) return

    const transaction = db.transaction([STORE_DOCUMENTS], 'readwrite')
    const store = transaction.objectStore(STORE_DOCUMENTS)
    
    await new Promise<void>((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error clearing document list cache:', error)
  }
}

/**
 * Remove a single document from cache
 */
export async function removeDocumentFromCache(documentId: string): Promise<void> {
  try {
    await initDocumentListCache()
    if (!db) return

    const transaction = db.transaction([STORE_DOCUMENTS], 'readwrite')
    const store = transaction.objectStore(STORE_DOCUMENTS)

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(documentId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error removing document from cache:', error)
  }
}

