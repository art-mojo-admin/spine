import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/auth'
import { apiGet, apiPost } from '@/lib/api'
import {
  getActiveAccountId,
  setActiveAccountId,
  getActiveAccountNodeId,
  setActiveAccountNodeId,
} from '@/lib/accountContext'
import type { Session, User } from '@supabase/supabase-js'

interface Profile {
  id: string
  person_id?: string
  display_name: string | null
  avatar_url: string | null
  system_role: string | null
}

interface Membership {
  id: string
  account_id: string
  account_role: string
  status: string
  account: {
    id: string
    display_name: string
    account_type: string
    status: string
  }
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  memberships: Membership[]
  currentAccountId: string | null
  currentAccountNodeId: string | null
  currentRole: string | null
  loading: boolean
  setCurrentAccountId: (id: string | null) => void
  setCurrentAccountNodeId: (id: string | null) => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentAccountId, setCurrentAccountIdState] = useState<string | null>(getActiveAccountId())
  const [currentAccountNodeId, setCurrentAccountNodeIdState] = useState<string | null>(getActiveAccountNodeId())
  const [loading, setLoading] = useState(true)

  const currentRole = memberships.find(m => m.account_id === currentAccountId)?.account_role ?? null

  const applyAccountContext = useCallback((accountId: string | null, nodeId?: string | null) => {
    setCurrentAccountIdState(accountId)
    setActiveAccountId(accountId)
    const resolvedNode = accountId ? (nodeId ?? accountId) : null
    setCurrentAccountNodeIdState(resolvedNode)
    setActiveAccountNodeId(resolvedNode)
  }, [])

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiGet<{ person: { id: string }; profile: Profile; memberships: Membership[] }>('me')
      setProfile({ ...data.profile, person_id: data.profile.person_id || data.person?.id })
      setMemberships(data.memberships)
      if (data.memberships.length === 0) {
        applyAccountContext(null, null)
        return
      }

      const stored = getActiveAccountId()
      const storedNode = getActiveAccountNodeId()
      const availableIds = data.memberships.map((m) => m.account_id)
      if (stored && availableIds.includes(stored)) {
        applyAccountContext(stored, storedNode)
        return
      }

      if (!currentAccountId) {
        const fallback = data.memberships[0].account_id
        applyAccountContext(fallback)
      }
    } catch (err: any) {
      if (err?.status === 401) {
        try {
          await apiPost('provision-user', {})
          const data = await apiGet<{ person: { id: string }; profile: Profile; memberships: Membership[] }>('me')
          setProfile({ ...data.profile, person_id: data.profile.person_id || data.person?.id })
          setMemberships(data.memberships)
          if (data.memberships.length > 0) {
            const stored = getActiveAccountId()
            const storedNode = getActiveAccountNodeId()
            const availableIds = data.memberships.map((m) => m.account_id)
            if (stored && availableIds.includes(stored)) {
              applyAccountContext(stored, storedNode)
            } else {
              const fallback = data.memberships[0].account_id
              applyAccountContext(fallback)
            }
          }
        } catch {
          // provisioning failed, fall through
        }
      }
      setProfile(null)
      setMemberships([])
      applyAccountContext(null, null)
    }
  }, [applyAccountContext, currentAccountId])

  const refresh = useCallback(async () => {
    await loadProfile()
  }, [loadProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s) loadProfile().finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s) loadProfile()
      else {
        setProfile(null)
        setMemberships([])
        applyAccountContext(null, null)
      }
    })

    return () => subscription.unsubscribe()
  }, [applyAccountContext, loadProfile])

  const setCurrentAccountId = useCallback((id: string | null) => {
    applyAccountContext(id)
  }, [applyAccountContext])

  const setCurrentAccountNodeId = useCallback((id: string | null) => {
    setCurrentAccountNodeIdState(id)
    setActiveAccountNodeId(id)
  }, [])

  return (
    <AuthContext.Provider value={{
      session, user, profile, memberships,
      currentAccountId, currentAccountNodeId, currentRole, loading,
      setCurrentAccountId, setCurrentAccountNodeId, refresh,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
