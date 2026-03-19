// API client for custom functions

const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9999' 
  : process.env.API_URL || ''

export async function apiGet(endpoint: string) {
  const response = await fetch(`${API_BASE}/.netlify/functions${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function apiPost(endpoint: string, data: any) {
  const response = await fetch(`${API_BASE}/.netlify/functions${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function apiPatch(endpoint: string, data: any) {
  const response = await fetch(`${API_BASE}/.netlify/functions${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function apiDelete(endpoint: string) {
  const response = await fetch(`${API_BASE}/.netlify/functions${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
