/**
 * Questions Cache Service
 * Provides IndexedDB caching for questions, threads, and messages
 * to enable offline mode and cross-device synchronization
 */

import { PageQuestionsData, PageQuestion } from './chatService'
import type { ChatMessage } from './chatService'
import { updateDocumentSyncMetadata, getDocumentSyncMetadata } from './documentListCache'

const DB_NAME = 'questions_cache_db'
const DB_VERSION = 2  // Incremented to remove documents store
const STORE_THREADS = 'threads'
const STORE_MESSAGES = 'messages'
const STORE_PAGE_QUESTIONS = 'page_questions'

interface CachedThread {
  id: string
  documentId: string
  title: string
  createdAt: string
  updatedAt: string
}

interface CachedMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  content: string
  pageContext?: number
  contextType?: string
  chapterId?: string
  createdAt: string
}

interface CachedPageQuestions {
  documentId: string
  pageNumber: number
  questions: PageQuestion[]
  lastModified: string
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
      
      // Create object stores if they don't exist
      // Note: documents store is removed - metadata is now in documentListCache
      
      if (!database.objectStoreNames.contains(STORE_THREADS)) {
        const threadsStore = database.createObjectStore(STORE_THREADS, { keyPath: 'id' })
        threadsStore.createIndex('documentId', 'documentId', { unique: false })
        threadsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      
      if (!database.objectStoreNames.contains(STORE_MESSAGES)) {
        const messagesStore = database.createObjectStore(STORE_MESSAGES, { keyPath: 'id' })
        messagesStore.createIndex('threadId', 'threadId', { unique: false })
        messagesStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      
      if (!database.objectStoreNames.contains(STORE_PAGE_QUESTIONS)) {
        const pageQuestionsStore = database.createObjectStore(STORE_PAGE_QUESTIONS, { 
          keyPath: ['documentId', 'pageNumber'] 
        })
        pageQuestionsStore.createIndex('documentId', 'documentId', { unique: false })
        pageQuestionsStore.createIndex('pageNumber', 'pageNumber', { unique: false })
      }
    }
  })
}

/**
 * Initialize cache
 */
export async function initQuestionsCache(): Promise<void> {
  if (isInitialized) return

  try {
    await initIndexedDB()
    isInitialized = true
    console.log('Questions cache initialized successfully')
  } catch (error) {
    console.error('Failed to initialize questions cache:', error)
    // Continue without cache (graceful degradation)
  }
}

/**
 * Cache document metadata (now uses documentListCache)
 */
export async function cacheDocumentMetadata(
  documentId: string, 
  lastSync: string, 
  lastModified: string
): Promise<void> {
  await updateDocumentSyncMetadata(documentId, lastSync, lastModified)
}

/**
 * Get document metadata (now uses documentListCache)
 */
export async function getDocumentMetadata(documentId: string): Promise<{
  documentId: string
  lastSync: string
  lastModified: string
  version: number
} | null> {
  const metadata = await getDocumentSyncMetadata(documentId)
  if (!metadata || !metadata.lastSync || !metadata.lastModified) {
    return null
  }
  
  return {
    documentId,
    lastSync: metadata.lastSync,
    lastModified: metadata.lastModified,
    version: metadata.version || 1
  }
}

/**
 * Cache threads for a document
 */
export async function cacheThreads(documentId: string, threads: CachedThread[]): Promise<void> {
  try {
    await initQuestionsCache()
    if (!db) return

    const transaction = db.transaction([STORE_THREADS], 'readwrite')
    const store = transaction.objectStore(STORE_THREADS)
    
    // First, remove old threads for this document
    const index = store.index('documentId')
    const range = IDBKeyRange.only(documentId)
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(range)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
    
    // Then, add new threads
    for (const thread of threads) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ ...thread, documentId })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  } catch (error) {
    console.error('Error caching threads:', error)
  }
}

/**
 * Get cached threads for a document
 */
export async function getCachedThreads(documentId: string): Promise<CachedThread[]> {
  try {
    await initQuestionsCache()
    if (!db) return []

    const transaction = db.transaction([STORE_THREADS], 'readonly')
    const store = transaction.objectStore(STORE_THREADS)
    const index = store.index('documentId')
    const range = IDBKeyRange.only(documentId)
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(range)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting cached threads:', error)
    return []
  }
}

/**
 * Cache messages for a thread
 * Accepts both ChatMessage[] (from API) and CachedMessage[] formats
 */
export async function cacheMessages(threadId: string, messages: (ChatMessage | CachedMessage)[]): Promise<void> {
  try {
    await initQuestionsCache()
    if (!db) return

    const transaction = db.transaction([STORE_MESSAGES], 'readwrite')
    const store = transaction.objectStore(STORE_MESSAGES)
    
    // First, remove old messages for this thread
    const index = store.index('threadId')
    const range = IDBKeyRange.only(threadId)
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(range)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
    
    // Then, add new messages (ensure threadId is set)
    for (const message of messages) {
      // Convert ChatMessage to CachedMessage format
      const cachedMessage: CachedMessage = {
        id: message.id,
        threadId: (message as CachedMessage).threadId || threadId,
        role: message.role,
        content: message.content,
        pageContext: message.pageContext,
        contextType: message.contextType,
        chapterId: message.chapterId,
        createdAt: message.createdAt
      }
      
      // Skip temporary messages (they start with 'temp-')
      if (cachedMessage.id.startsWith('temp-')) {
        continue
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cachedMessage)
        request.onsuccess = () => resolve()
        request.onerror = (err) => {
          console.error('Error putting message:', err, cachedMessage)
          reject(request.error)
        }
      })
    }
  } catch (error) {
    console.error('Error caching messages:', error)
  }
}

/**
 * Append messages to cache (for incremental updates)
 * Accepts both ChatMessage[] (from API) and CachedMessage[] formats
 */
export async function appendMessages(threadId: string, messages: (ChatMessage | CachedMessage)[]): Promise<void> {
  try {
    await initQuestionsCache()
    if (!db) return

    const transaction = db.transaction([STORE_MESSAGES], 'readwrite')
    const store = transaction.objectStore(STORE_MESSAGES)
    
    // Get existing messages to avoid duplicates
    const existingMessages = await getCachedMessages(threadId)
    const existingIds = new Set(existingMessages.map(m => m.id))
    
    // Add only new messages
    for (const message of messages) {
      // Convert ChatMessage to CachedMessage format
      const cachedMessage: CachedMessage = {
        id: message.id,
        threadId: (message as CachedMessage).threadId || threadId,
        role: message.role,
        content: message.content,
        pageContext: message.pageContext,
        contextType: message.contextType,
        chapterId: message.chapterId,
        createdAt: message.createdAt
      }
      
      // Skip temporary messages (they start with 'temp-')
      if (cachedMessage.id.startsWith('temp-')) {
        continue
      }
      
      if (!existingIds.has(cachedMessage.id)) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(cachedMessage)
          request.onsuccess = () => resolve()
          request.onerror = (err) => {
            console.error('Error appending message:', err, cachedMessage)
            reject(request.error)
          }
        })
      }
    }
  } catch (error) {
    console.error('Error appending messages:', error)
  }
}

/**
 * Get cached messages for a thread
 */
export async function getCachedMessages(threadId: string): Promise<CachedMessage[]> {
  try {
    await initQuestionsCache()
    if (!db) return []

    const transaction = db.transaction([STORE_MESSAGES], 'readonly')
    const store = transaction.objectStore(STORE_MESSAGES)
    const index = store.index('threadId')
    const range = IDBKeyRange.only(threadId)
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(range)
      request.onsuccess = () => {
        const messages = request.result || []
        // Sort by createdAt
        messages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        resolve(messages)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting cached messages:', error)
    return []
  }
}

/**
 * Cache page questions
 */
export async function cachePageQuestions(
  documentId: string,
  pageNumber: number,
  questions: PageQuestion[],
  lastModified: string
): Promise<void> {
  try {
    await initQuestionsCache()
    if (!db) return

    const transaction = db.transaction([STORE_PAGE_QUESTIONS], 'readwrite')
    const store = transaction.objectStore(STORE_PAGE_QUESTIONS)
    
    const cached: CachedPageQuestions = {
      documentId,
      pageNumber,
      questions,
      lastModified
    }
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(cached)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error caching page questions:', error)
  }
}

/**
 * Cache all questions for a document (from AllDocumentQuestionsResponse)
 */
export async function cacheAllQuestions(
  documentId: string,
  pages: PageQuestionsData[],
  lastModified: string
): Promise<void> {
  try {
    await initQuestionsCache()
    if (!db) return

    const transaction = db.transaction([STORE_PAGE_QUESTIONS], 'readwrite')
    const store = transaction.objectStore(STORE_PAGE_QUESTIONS)
    
    // Remove old questions for this document
    const index = store.index('documentId')
    const range = IDBKeyRange.only(documentId)
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(range)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
    
    // Add new questions
    for (const pageData of pages) {
      const cached: CachedPageQuestions = {
        documentId,
        pageNumber: pageData.pageNumber,
        questions: pageData.questions,
        lastModified
      }
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(cached)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  } catch (error) {
    console.error('Error caching all questions:', error)
  }
}

/**
 * Get cached questions for a page
 */
export async function getCachedPageQuestions(
  documentId: string,
  pageNumber: number
): Promise<PageQuestionsData | null> {
  try {
    await initQuestionsCache()
    if (!db) return null

    const transaction = db.transaction([STORE_PAGE_QUESTIONS], 'readonly')
    const store = transaction.objectStore(STORE_PAGE_QUESTIONS)
    
    return new Promise((resolve, reject) => {
      const request = store.get([documentId, pageNumber])
      request.onsuccess = () => {
        const cached = request.result as CachedPageQuestions | undefined
        if (cached) {
          resolve({
            pageNumber: cached.pageNumber,
            totalQuestions: cached.questions.length,
            questions: cached.questions
          })
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting cached page questions:', error)
    return null
  }
}

/**
 * Get all cached questions for a document
 */
export async function getAllCachedQuestions(documentId: string): Promise<Map<number, PageQuestionsData>> {
  try {
    await initQuestionsCache()
    if (!db) return new Map()

    const transaction = db.transaction([STORE_PAGE_QUESTIONS], 'readonly')
    const store = transaction.objectStore(STORE_PAGE_QUESTIONS)
    const index = store.index('documentId')
    const range = IDBKeyRange.only(documentId)
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(range)
      request.onsuccess = () => {
        const cached = request.result || []
        const map = new Map<number, PageQuestionsData>()
        
        for (const item of cached as CachedPageQuestions[]) {
          map.set(item.pageNumber, {
            pageNumber: item.pageNumber,
            totalQuestions: item.questions.length,
            questions: item.questions
          })
        }
        
        resolve(map)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error getting all cached questions:', error)
    return new Map()
  }
}

/**
 * Invalidate cache for a document
 */
export async function invalidateCache(documentId: string): Promise<void> {
  try {
    await initQuestionsCache()
    if (!db) return

    // Note: Document metadata is now in documentListCache, no need to remove it here
    
    // Remove threads
    const threadsTransaction = db.transaction([STORE_THREADS], 'readwrite')
    const threadsStore = threadsTransaction.objectStore(STORE_THREADS)
    const threadsIndex = threadsStore.index('documentId')
    const threadsRange = IDBKeyRange.only(documentId)
    await new Promise<void>((resolve, reject) => {
      const request = threadsIndex.openCursor(threadsRange)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
    
    // Remove messages (need to get thread IDs first)
    const cachedThreads = await getCachedThreads(documentId)
    const threadIds = cachedThreads.map(t => t.id)
    
    for (const threadId of threadIds) {
      const messagesTransaction = db.transaction([STORE_MESSAGES], 'readwrite')
      const messagesStore = messagesTransaction.objectStore(STORE_MESSAGES)
      const messagesIndex = messagesStore.index('threadId')
      const messagesRange = IDBKeyRange.only(threadId)
      await new Promise<void>((resolve, reject) => {
        const request = messagesIndex.openCursor(messagesRange)
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })
    }
    
    // Remove page questions
    const pageQuestionsTransaction = db.transaction([STORE_PAGE_QUESTIONS], 'readwrite')
    const pageQuestionsStore = pageQuestionsTransaction.objectStore(STORE_PAGE_QUESTIONS)
    const pageQuestionsIndex = pageQuestionsStore.index('documentId')
    const pageQuestionsRange = IDBKeyRange.only(documentId)
    await new Promise<void>((resolve, reject) => {
      const request = pageQuestionsIndex.openCursor(pageQuestionsRange)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error invalidating cache:', error)
  }
}

/**
 * Check if there are updates available on server
 */
export async function checkForUpdates(
  documentId: string,
  serverLastModified: string
): Promise<boolean> {
  try {
    const metadata = await getDocumentMetadata(documentId)
    if (!metadata) return true  // No cache, need to fetch
    
    const cachedTime = new Date(metadata.lastModified).getTime()
    const serverTime = new Date(serverLastModified).getTime()
    
    return serverTime > cachedTime
  } catch (error) {
    console.error('Error checking for updates:', error)
    return true  // Assume updates available on error
  }
}

