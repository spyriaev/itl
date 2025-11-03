const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/**
 * Get current session token
 */
async function getAuthToken(): Promise<string | null> {
  const { supabase } = await import('../lib/supabase')
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export interface UserPlan {
  id: string
  userId: string
  planType: 'beta' | 'base' | 'plus'
  status: 'active' | 'trial' | 'expired'
  startedAt: string
  expiresAt: string | null
}

export interface PlanLimits {
  planType: string
  maxStorageBytes: number
  maxFiles: number | null
  maxSingleFileBytes: number
  maxTokensPerMonth: number
  maxQuestionsPerMonth: number
}

export interface UserUsage {
  userId: string
  planId: string
  planType: string
  periodStart: string
  periodEnd: string
  storageBytesUsed: number
  filesCount: number
  tokensUsed: number
  questionsCount: number
  limits: PlanLimits
}

/**
 * Get current user's plan
 */
export async function getUserPlan(): Promise<UserPlan> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/user/plan`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get user plan: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Set or change user's plan
 */
export async function setUserPlan(planType: 'beta' | 'base' | 'plus'): Promise<UserPlan> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/user/plan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ planType }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || `Failed to set user plan: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get current user's resource usage
 */
export async function getUserUsage(): Promise<UserUsage> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_URL}/api/user/usage`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get user usage: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Calculate percentage used
 */
export function calculatePercentage(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

