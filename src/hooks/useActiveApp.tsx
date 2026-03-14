import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  clearStoredActiveApp,
  getStoredActiveApp,
  setStoredActiveApp,
  type ActiveAppEntry,
} from '@/lib/activeAppStorage'

export interface ActiveAppSelection {
  packId: string
  packName?: string | null
  appId: string
  appName?: string | null
}

interface ActiveAppContextValue {
  activeApp: ActiveAppEntry | null
  isHydrated: boolean
  setActiveApp: (selection: ActiveAppSelection) => void
  clearActiveApp: () => void
}

const ActiveAppContext = createContext<ActiveAppContextValue | undefined>(undefined)

function emitActiveAppEvent(
  type: 'active-app:selected' | 'active-app:cleared',
  detail: Record<string, unknown>,
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(type, { detail }))
}

export function ActiveAppProvider({ children }: { children: ReactNode }) {
  const { currentAccountId } = useAuth()
  const [activeApp, setActiveAppState] = useState<ActiveAppEntry | null>(null)
  const [isHydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(false)
    if (!currentAccountId) {
      setActiveAppState(null)
      setHydrated(true)
      return
    }

    const stored = getStoredActiveApp(currentAccountId)
    setActiveAppState(stored)
    setHydrated(true)
  }, [currentAccountId])

  const setActiveApp = useCallback((selection: ActiveAppSelection) => {
    if (!currentAccountId) {
      console.warn('Cannot set active app without an account context')
      return
    }

    const entry: ActiveAppEntry = {
      packId: selection.packId,
      packName: selection.packName ?? null,
      appId: selection.appId,
      appName: selection.appName ?? null,
      updatedAt: new Date().toISOString(),
    }

    setActiveAppState(entry)
    setStoredActiveApp(currentAccountId, entry)
    emitActiveAppEvent('active-app:selected', {
      accountId: currentAccountId,
      packId: entry.packId,
      appId: entry.appId,
    })
  }, [currentAccountId])

  const clearActiveApp = useCallback(() => {
    if (currentAccountId) {
      clearStoredActiveApp(currentAccountId)
    }
    setActiveAppState(null)
    emitActiveAppEvent('active-app:cleared', {
      accountId: currentAccountId,
    })
  }, [currentAccountId])

  const value = useMemo<ActiveAppContextValue>(() => ({
    activeApp,
    isHydrated,
    setActiveApp,
    clearActiveApp,
  }), [activeApp, isHydrated, setActiveApp, clearActiveApp])

  return (
    <ActiveAppContext.Provider value={value}>
      {children}
    </ActiveAppContext.Provider>
  )
}

export function useActiveApp() {
  const ctx = useContext(ActiveAppContext)
  if (!ctx) {
    throw new Error('useActiveApp must be used within ActiveAppProvider')
  }
  return ctx
}
