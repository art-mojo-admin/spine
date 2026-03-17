import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { getImpersonationSessionId, setImpersonationSessionId } from '@/lib/impersonationContext'
import { setActiveAccountId } from '@/lib/accountContext'
import { useAuth } from './useAuth'

interface ImpersonationTarget {
  id: string
  full_name: string
  email: string
}

interface ImpersonationAccount {
  id: string
  display_name: string
}

interface ImpersonationSession {
  id: string
  admin_person_id: string
  target_person_id: string
  target_account_id: string
  target_account_role: string
  reason: string | null
  started_at: string
  expires_at: string
  target_person?: ImpersonationTarget
  target_account?: ImpersonationAccount
}

interface ImpersonationState {
  active: boolean
  session: ImpersonationSession | null
  loading: boolean
  startImpersonation: (targetPersonId: string, targetAccountId: string, reason?: string) => Promise<void>
  stopImpersonation: () => Promise<void>
}

const ImpersonationContext = createContext<ImpersonationState | undefined>(undefined)

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ImpersonationSession | null>(null)
  const [loading, setLoading] = useState(true)
  const { profile, refresh, setCurrentAccountId } = useAuth()

  const isSystemAdmin = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'

  // On mount, check for an existing active session
  useEffect(() => {
    const existingId = getImpersonationSessionId()
    if (!existingId || !isSystemAdmin) {
      setLoading(false)
      return
    }

    apiGet<{ session: ImpersonationSession | null }>('impersonate')
      .then(({ session: s }) => {
        if (s) {
          setSession(s)
          setActiveAccountId(s.target_account_id)
        } else {
          // Session expired or ended server-side
          setImpersonationSessionId(null)
        }
      })
      .catch(() => {
        setImpersonationSessionId(null)
      })
      .finally(() => setLoading(false))
  }, [isSystemAdmin])

  const startImpersonation = useCallback(async (
    targetPersonId: string,
    targetAccountId: string,
    reason?: string,
  ) => {
    const { session: s } = await apiPost<{ session: ImpersonationSession }>('impersonate', {
      target_person_id: targetPersonId,
      target_account_id: targetAccountId,
      reason,
    })

    setImpersonationSessionId(s.id)
    setSession(s)
    setActiveAccountId(s.target_account_id)
    setCurrentAccountId(s.target_account_id)
    await refresh()
  }, [refresh, setCurrentAccountId])

  const stopImpersonation = useCallback(async () => {
    const existingId = getImpersonationSessionId()
    if (existingId) {
      await apiDelete('impersonate', { session_id: existingId }).catch(() => {})
    }

    setImpersonationSessionId(null)
    setSession(null)
    // Refresh will restore the admin's own context
    await refresh()
  }, [refresh])

  return (
    <ImpersonationContext.Provider value={{
      active: !!session,
      session,
      loading,
      startImpersonation,
      stopImpersonation,
    }}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext)
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider')
  return ctx
}
