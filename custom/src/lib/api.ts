// API client for custom functions

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9999' 
  : '/.netlify/functions'

interface ApiOptions {
  method?: string
  body?: unknown
  params?: Record<string, string>
  tokenOverride?: string | null
}

export async function api<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options

  let url = `${API_BASE}/${endpoint.replace(/^\//, '')}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiGet = <T = any>(endpoint: string, params?: Record<string, string>) =>
  api<T>(endpoint, { params })

type ApiPostOptions = Pick<ApiOptions, 'params' | 'tokenOverride'>

export const apiPost = <T = any>(endpoint: string, body: unknown, options?: ApiPostOptions) =>
  api<T>(endpoint, { method: 'POST', body, ...(options || {}) })

export const apiPatch = <T = any>(endpoint: string, body: unknown, params?: Record<string, string>) =>
  api<T>(endpoint, { method: 'PATCH', body, params })

export const apiDelete = <T = any>(endpoint: string, params?: Record<string, string>) =>
  api<T>(endpoint, { method: 'DELETE', params })
