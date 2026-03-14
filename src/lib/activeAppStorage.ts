import { STORAGE_PREFIX } from '@/lib/config'

const STORAGE_KEY = `${STORAGE_PREFIX}.activeApps`

type ActiveAppStorageBlob = Record<string, ActiveAppEntry>

let cache: ActiveAppStorageBlob | null = null

export interface ActiveAppEntry {
  packId: string
  packName: string | null
  appId: string
  appName: string | null
  updatedAt: string
}

function readStore(): ActiveAppStorageBlob {
  if (cache) return cache
  if (typeof window === 'undefined') {
    cache = {}
    return cache
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    cache = {}
    return cache
  }

  try {
    const parsed = JSON.parse(raw) as ActiveAppStorageBlob
    cache = parsed && typeof parsed === 'object' ? parsed : {}
    return cache
  } catch {
    cache = {}
    return cache
  }
}

function writeStore(next: ActiveAppStorageBlob) {
  cache = next
  if (typeof window === 'undefined') return
  if (Object.keys(next).length === 0) {
    window.localStorage.removeItem(STORAGE_KEY)
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
}

export function getStoredActiveApp(accountId: string | null): ActiveAppEntry | null {
  if (!accountId) return null
  const store = readStore()
  return store[accountId] ?? null
}

export function setStoredActiveApp(accountId: string, entry: ActiveAppEntry) {
  if (!accountId) return
  const store = { ...readStore(), [accountId]: entry }
  writeStore(store)
}

export function clearStoredActiveApp(accountId?: string | null) {
  const store = { ...readStore() }
  if (!accountId) {
    writeStore({})
    return
  }
  if (store[accountId]) {
    delete store[accountId]
    writeStore(store)
  }
}

export function getActiveAppStorageKey() {
  return STORAGE_KEY
}
