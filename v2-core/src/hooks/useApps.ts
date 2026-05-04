import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export interface AppRecord {
  id: string
  slug: string
  name: string
  description?: string
  icon?: string
  color?: string
  version?: string
  app_type: string
  source: string
  config: Record<string, any>
  nav_items: any[]
  min_role?: string
  is_active: boolean
  is_system: boolean
  route_prefix: string | null
  renderer: 'generic' | 'custom' | 'none'
}

interface UseAppsResult {
  apps: AppRecord[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetches active apps for the current account and filters by user roles.
 * Apps with renderer='none' or route_prefix=null are excluded from routing
 * but still returned for API-only consumers.
 */
export function useApps(): UseAppsResult {
  const { user } = useAuth()
  const [apps, setApps] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchApps = async () => {
    if (!user) {
      setApps([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch('/api/apps?action=list')

      if (!response.ok) {
        throw new Error(`Failed to fetch apps: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const allApps: AppRecord[] = data.data || data || []

      // Filter by user's roles: include app if user has the min_role or higher,
      // or if app has no min_role restriction
      const accessible = allApps.filter(app => {
        if (!app.is_active) return false
        if (!app.min_role) return true
        if (!user.roles || user.roles.length === 0) return false
        // system_admin can access everything
        if (user.roles.includes('system_admin')) return true
        // Check if user has the required role
        return user.roles.includes(app.min_role)
      })

      setApps(accessible)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load apps')
      setApps([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApps()
  }, [user?.id, user?.account_id])

  return { apps, loading, error, refetch: fetchApps }
}

/**
 * Returns only routable apps (those with a route_prefix and renderer != 'none').
 */
export function useRoutableApps() {
  const result = useApps()
  return {
    ...result,
    apps: result.apps.filter(app => app.route_prefix != null && app.renderer !== 'none')
  }
}
