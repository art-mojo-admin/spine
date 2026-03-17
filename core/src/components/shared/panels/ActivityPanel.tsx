import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'

interface ActivityPanelProps {
  entityType: string
  entityId: string
}

export function ActivityPanel({ entityType, entityId }: ActivityPanelProps) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<any[]>('activity-events', { entity_type: entityType, entity_id: entityId })
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {events.slice(0, 20).map((e: any) => (
              <div key={e.id} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span>{e.summary}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
