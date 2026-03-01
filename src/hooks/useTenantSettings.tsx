import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type OrgModel = 'single' | 'multi'

export interface TenantSettings {
  org_model: OrgModel
  installed_packs: string[]
  configured_at: string | null
  configured_by: string | null
  metadata: Record<string, any>
}

interface TenantSettingsResponse extends TenantSettings {
  configured_by_person?: {
    id: string
    full_name: string | null
    email: string | null
  } | null
}

export function useTenantSettings() {
  const { currentAccountId, currentRole, profile } = useAuth()
  const [settings, setSettings] = useState<TenantSettingsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canConfigure = Boolean(
    profile?.system_role === 'system_admin' ||
      profile?.system_role === 'system_operator' ||
      currentRole === 'admin',
  )

  const load = useCallback(async () => {
    if (!currentAccountId || !canConfigure) {
      setSettings(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<TenantSettingsResponse>('tenant-settings')
      setSettings(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load tenant settings')
    } finally {
      setLoading(false)
    }
  }, [currentAccountId, canConfigure])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (payload: Partial<TenantSettings>) => {
    if (!canConfigure) {
      throw new Error('Insufficient permissions to update tenant settings')
    }
    const data = await apiPost<TenantSettingsResponse>('tenant-settings', payload)
    setSettings(data)
    return data
  }, [canConfigure])

  return {
    settings,
    loading,
    error,
    refresh: load,
    save,
    canConfigure,
  }
}
