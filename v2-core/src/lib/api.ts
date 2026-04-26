import { supabase } from './supabase'

// Module-level account context
let _accountId: string | null = null

export function setAccountId(id: string | null) {
  _accountId = id
}

export function getAccountId(): string | null {
  return _accountId
}

 function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
   if (!headers) return {}

   if (headers instanceof Headers) {
     return Object.fromEntries(headers.entries())
   }

   if (Array.isArray(headers)) {
     return Object.fromEntries(headers)
   }

   return Object.fromEntries(
     Object.entries(headers).map(([key, value]) => [key, String(value)])
   )
 }

// Get auth headers from Supabase session
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  if (_accountId) {
    headers['X-Account-Id'] = _accountId
  }

  return headers
}

// Authenticated fetch wrapper
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  console.log('apiFetch called with:', { path, options, signal: options.signal })
  const authHeaders = await getAuthHeaders()
  const optionHeaders = normalizeHeaders(options.headers)
  const optionAuthorization = optionHeaders.Authorization || optionHeaders.authorization

  if (
    optionAuthorization &&
    ['Bearer null', 'Bearer undefined', 'null', 'undefined', ''].includes(optionAuthorization.trim())
  ) {
    delete optionHeaders.Authorization
    delete optionHeaders.authorization
  }

  const fetchOptions = {
    ...options,
    headers: {
      ...authHeaders,
      ...optionHeaders,
    },
  }
  console.log('apiFetch final options:', { fetchOptions, signal: fetchOptions.signal })
  return fetch(path, fetchOptions)
}
