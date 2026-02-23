import { STORAGE_PREFIX } from '@/lib/config'

const STORAGE_KEY = `${STORAGE_PREFIX}.activeAccountId`

let activeAccountId: string | null = null

export function getActiveAccountId(): string | null {
  if (activeAccountId) return activeAccountId
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  activeAccountId = stored
  return stored
}

export function setActiveAccountId(id: string | null) {
  activeAccountId = id
  if (typeof window === 'undefined') return
  if (id) {
    window.localStorage.setItem(STORAGE_KEY, id)
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
