import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import type { CommunityBootstrapPayload } from '../types'

interface CommunityBootstrapState {
  data: CommunityBootstrapPayload | null
  loading: boolean
  error: string | null
}

export function useCommunityBootstrap(): CommunityBootstrapState {
  const [data, setData] = useState<CommunityBootstrapPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const payload = await apiGet<CommunityBootstrapPayload>('community-bootstrap')
        if (!cancelled) {
          setData(payload)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load community data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
