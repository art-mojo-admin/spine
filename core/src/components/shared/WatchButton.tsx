import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

interface WatchButtonProps {
  entityType: string
  entityId: string
}

export function WatchButton({ entityType, entityId }: WatchButtonProps) {
  const [watching, setWatching] = useState(false)
  const [watcherId, setWatcherId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    setLoading(true)
    apiGet<{ watching: boolean; watcher_id: string | null }>('entity-watchers', {
      entity_type: entityType,
      entity_id: entityId,
      check: 'me',
    })
      .then((res) => {
        setWatching(res.watching)
        setWatcherId(res.watcher_id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  async function toggle() {
    setToggling(true)
    try {
      if (watching && watcherId) {
        await apiDelete('entity-watchers', { id: watcherId })
        setWatching(false)
        setWatcherId(null)
      } else {
        const result = await apiPost<any>('entity-watchers', {
          entity_type: entityType,
          entity_id: entityId,
        })
        setWatching(true)
        setWatcherId(result.id)
      }
    } catch {
      // Silently fail
    } finally {
      setToggling(false)
    }
  }

  if (loading) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={toggling}
      onClick={toggle}
      className="gap-1.5"
    >
      {watching ? (
        <>
          <EyeOff className="h-4 w-4" />
          Unwatch
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          Watch
        </>
      )}
    </Button>
  )
}
