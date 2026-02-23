import { STORAGE_PREFIX } from '@/lib/config'

const STORAGE_KEY = `${STORAGE_PREFIX}.impersonationSessionId`

let sessionId: string | null = null

export function getImpersonationSessionId(): string | null {
  if (sessionId) return sessionId
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  sessionId = stored
  return stored
}

export function setImpersonationSessionId(id: string | null) {
  sessionId = id
  if (typeof window === 'undefined') return
  if (id) {
    window.localStorage.setItem(STORAGE_KEY, id)
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
