import { getAccessToken } from './auth'
import { generateRequestId } from './utils'
import { getActiveAccountId } from './accountContext'
import { getImpersonationSessionId } from './impersonationContext'

const API_BASE = '/.netlify/functions'

interface ApiOptions {
  method?: string
  body?: unknown
  params?: Record<string, string>
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options
  const token = await getAccessToken()
  const requestId = generateRequestId()

  let url = `${API_BASE}/${endpoint}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const activeAccountId = getActiveAccountId()
  if (activeAccountId) {
    headers['X-Account-Id'] = activeAccountId
  }
  const impersonationSessionId = getImpersonationSessionId()
  if (impersonationSessionId) {
    headers['X-Impersonate-Session-Id'] = impersonationSessionId
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, err.error || res.statusText, requestId)
  }

  return res.json()
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiGet = <T = unknown>(endpoint: string, params?: Record<string, string>) =>
  api<T>(endpoint, { params })

export const apiPost = <T = unknown>(endpoint: string, body: unknown) =>
  api<T>(endpoint, { method: 'POST', body })

export const apiPatch = <T = unknown>(endpoint: string, body: unknown, params?: Record<string, string>) =>
  api<T>(endpoint, { method: 'PATCH', body, params })

export const apiDelete = <T = unknown>(endpoint: string, params?: Record<string, string>) =>
  api<T>(endpoint, { method: 'DELETE', params })
