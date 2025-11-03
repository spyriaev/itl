/**
 * PDF Cache Service
 * Provides two-level caching using Cache API and IndexedDB for optimal performance
 * on mobile devices and tablets.
 */

const DB_NAME = 'pdf_cache_db'
const DB_VERSION = 1
const STORE_NAME = 'pdf_blobs'
const CACHE_NAME = 'pdf-files-v1'
const MAX_CACHE_SIZE_MB = 500 // Maximum cache size in MB
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024

interface CacheEntry {
  blob: Blob
  url: string
  cachedAt: number
  lastAccessed: number
  size: number
}

interface CacheStats {
  fileCount: number
  totalSize: number
  totalSizeMB: number
  maxSizeMB: number
  availableSizeMB: number
}

let db: IDBDatabase | null = null
let cacheAPI: Cache | null = null
let isInitialized = false

/**
 * Detect if device is mobile or tablet
 */
export function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent.toLowerCase())
  
  return isMobile || isTablet
}

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'documentId' })
        objectStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
        objectStore.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })
}

/**
 * Initialize Cache API
 */
async function initCacheAPI(): Promise<Cache | null> {
  if (!('caches' in window)) {
    console.warn('Cache API not available')
    return null
  }

  try {
    cacheAPI = await caches.open(CACHE_NAME)
    return cacheAPI
  } catch (error) {
    console.error('Failed to open Cache API:', error)
    return null
  }
}

/**
 * Initialize both storage mechanisms
 */
export async function initCache(): Promise<void> {
  if (isInitialized) return

  try {
    // Initialize IndexedDB
    await initIndexedDB()
    
    // Initialize Cache API
    await initCacheAPI()
    
    isInitialized = true
    console.log('PDF cache initialized successfully')
  } catch (error) {
    console.error('Failed to initialize PDF cache:', error)
    // Continue without cache (graceful degradation)
  }
}

/**
 * Get PDF from cache (checks both storage mechanisms)
 */
export async function getPdfFromCache(documentId: string): Promise<{ blob: Blob; url: string } | null> {
  try {
    await initCache()

    // Try Cache API first (faster on mobile)
    if (cacheAPI) {
      try {
        const cachedResponse = await cacheAPI.match(documentId)
        if (cachedResponse) {
          const blob = await cachedResponse.blob()
          
          // Update lastAccessed in IndexedDB if available
          if (db) {
            await updateLastAccessed(db, documentId)
          }
          
          const url = URL.createObjectURL(blob)
          return { blob, url }
        }
      } catch (error) {
        console.warn('Error reading from Cache API:', error)
      }
    }

    // Fallback to IndexedDB
    if (db) {
      try {
        const entry = await getFromIndexedDB(db, documentId)
        if (entry) {
          // Update lastAccessed
          await updateLastAccessed(db, documentId)
          
          // Also try to save to Cache API for faster future access
          if (cacheAPI) {
            try {
              await cacheAPI.put(documentId, new Response(entry.blob))
            } catch (error) {
              console.warn('Failed to sync to Cache API:', error)
            }
          }
          
          const url = URL.createObjectURL(entry.blob)
          return { blob: entry.blob, url }
        }
      } catch (error) {
        console.warn('Error reading from IndexedDB:', error)
      }
    }

    return null
  } catch (error) {
    console.error('Error getting PDF from cache:', error)
    return null
  }
}

/**
 * Get entry from IndexedDB
 */
function getFromIndexedDB(db: IDBDatabase, documentId: string): Promise<CacheEntry | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(documentId)

    request.onsuccess = () => {
      const result = request.result
      if (result) {
        // IndexedDB stores Blob objects directly in modern browsers
        // If it's not a Blob (e.g., ArrayBuffer), convert it
        let blob: Blob
        if (result.blob instanceof Blob) {
          blob = result.blob
        } else if (result.blob instanceof ArrayBuffer) {
          blob = new Blob([result.blob], { type: 'application/pdf' })
        } else {
          // Fallback: try to create Blob from whatever we have
          blob = new Blob([result.blob], { type: 'application/pdf' })
        }
        resolve({
          blob,
          url: result.url,
          cachedAt: result.cachedAt,
          lastAccessed: result.lastAccessed,
          size: result.size
        })
      } else {
        resolve(null)
      }
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * Update lastAccessed timestamp in IndexedDB
 */
function updateLastAccessed(db: IDBDatabase, documentId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(documentId)

    getRequest.onsuccess = () => {
      const entry = getRequest.result
      if (entry) {
        entry.lastAccessed = Date.now()
        const putRequest = store.put(entry)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        resolve()
      }
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Calculate total cache size from IndexedDB
 */
async function getCacheSize(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const entries = request.result
      const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0)
      resolve(totalSize)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all entries sorted by lastAccessed (oldest first)
 */
function getAllEntriesSorted(db: IDBDatabase): Promise<Array<{ documentId: string; lastAccessed: number; size: number }>> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('lastAccessed')
    const request = index.getAll()

    request.onsuccess = () => {
      const entries = request.result.map((entry: any) => ({
        documentId: entry.documentId || entry.key,
        lastAccessed: entry.lastAccessed || 0,
        size: entry.size || 0
      }))
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed)
      resolve(entries)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Remove entry from both storages
 */
async function removeEntry(documentId: string): Promise<void> {
  // Remove from IndexedDB
  if (db) {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(documentId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.warn('Failed to remove from IndexedDB:', error)
    }
  }

  // Remove from Cache API
  if (cacheAPI) {
    try {
      await cacheAPI.delete(documentId)
    } catch (error) {
      console.warn('Failed to remove from Cache API:', error)
    }
  }
}

/**
 * Free up space if cache is too large (LRU eviction)
 */
async function evictOldEntries(db: IDBDatabase, requiredSize: number): Promise<void> {
  try {
    const currentSize = await getCacheSize(db)
    const targetSize = MAX_CACHE_SIZE_BYTES - requiredSize

    if (currentSize <= targetSize) {
      return
    }

    const entries = await getAllEntriesSorted(db)
    let freedSize = 0

    for (const entry of entries) {
      if (currentSize - freedSize <= targetSize) {
        break
      }
      
      await removeEntry(entry.documentId)
      freedSize += entry.size
    }

    console.log(`Evicted ${freedSize} bytes from cache`)
  } catch (error) {
    console.error('Error evicting cache entries:', error)
  }
}

/**
 * Save PDF to cache (saves to both storage mechanisms)
 */
export async function savePdfToCache(documentId: string, blob: Blob, url: string): Promise<void> {
  try {
    await initCache()

    const size = blob.size
    const now = Date.now()

    // Check if we need to free up space
    if (db) {
      await evictOldEntries(db, size)
    }

    // Save to IndexedDB
    if (db) {
      try {
        const entry: CacheEntry = {
          blob,
          url,
          cachedAt: now,
          lastAccessed: now,
          size
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        
        // Store with documentId as key
        await new Promise<void>((resolve, reject) => {
          const request = store.put({
            documentId,
            ...entry
          })
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      } catch (error) {
        console.error('Failed to save to IndexedDB:', error)
        // Continue - we'll try Cache API
      }
    }

    // Save to Cache API
    if (cacheAPI) {
      try {
        await cacheAPI.put(documentId, new Response(blob))
      } catch (error) {
        console.warn('Failed to save to Cache API:', error)
        // Continue - IndexedDB is the primary storage
      }
    }
  } catch (error) {
    console.error('Error saving PDF to cache:', error)
    // Don't throw - caching is optional
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  try {
    await initCache()

    if (!db) {
      return {
        fileCount: 0,
        totalSize: 0,
        totalSizeMB: 0,
        maxSizeMB: MAX_CACHE_SIZE_MB,
        availableSizeMB: MAX_CACHE_SIZE_MB
      }
    }

    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const entries = request.result
        const fileCount = entries.length
        const totalSize = entries.reduce((sum: number, entry: any) => sum + (entry.size || 0), 0)
        const totalSizeMB = totalSize / (1024 * 1024)
        const availableSizeMB = Math.max(0, MAX_CACHE_SIZE_MB - totalSizeMB)

        resolve({
          fileCount,
          totalSize,
          totalSizeMB,
          maxSizeMB: MAX_CACHE_SIZE_MB,
          availableSizeMB
        })
      }

      request.onerror = () => {
        resolve({
          fileCount: 0,
          totalSize: 0,
          totalSizeMB: 0,
          maxSizeMB: MAX_CACHE_SIZE_MB,
          availableSizeMB: MAX_CACHE_SIZE_MB
        })
      }
    })
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return {
      fileCount: 0,
      totalSize: 0,
      totalSizeMB: 0,
      maxSizeMB: MAX_CACHE_SIZE_MB,
      availableSizeMB: MAX_CACHE_SIZE_MB
    }
  }
}

/**
 * Clear entire cache
 */
export async function clearCache(): Promise<void> {
  try {
    // Clear IndexedDB
    if (db) {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      await new Promise<void>((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }

    // Clear Cache API
    if (cacheAPI) {
      await caches.delete(CACHE_NAME)
      cacheAPI = null
    }

    // Reinitialize
    await initCache()
    
    console.log('Cache cleared successfully')
  } catch (error) {
    console.error('Error clearing cache:', error)
    throw error
  }
}

/**
 * Remove specific document from cache
 */
export async function removeFromCache(documentId: string): Promise<void> {
  await removeEntry(documentId)
}

