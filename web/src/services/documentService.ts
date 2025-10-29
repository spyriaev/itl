import { DocumentStructure, ChapterInfo } from '../types/document'
import { supabase } from '../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}

export async function extractDocumentStructure(
  documentId: string,
  force: boolean = false
): Promise<DocumentStructure | null> {
  try {
    const response = await apiRequest(`/api/documents/${documentId}/extract-structure`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to extract document structure')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error extracting document structure:', error)
    return null
  }
}

export async function getDocumentStructure(documentId: string): Promise<DocumentStructure | null> {
  try {
    const response = await apiRequest(`/api/documents/${documentId}/structure`, {
      method: 'GET'
    })
    
    if (!response.ok) {
      throw new Error('Failed to get document structure')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error getting document structure:', error)
    return null
  }
}

export async function getChapterForPage(
  documentId: string,
  pageNumber: number,
  level?: number
): Promise<ChapterInfo | null> {
  try {
    const url = `/api/documents/${documentId}/pages/${pageNumber}/chapter${level !== undefined ? `?level=${level}` : ''}`
    const response = await apiRequest(url, {
      method: 'GET'
    })
    
    if (!response.ok) {
      throw new Error('Failed to get chapter info')
    }
    
    const data = await response.json()
    return data || null
  } catch (error) {
    console.error('Error getting chapter info:', error)
    return null
  }
}
