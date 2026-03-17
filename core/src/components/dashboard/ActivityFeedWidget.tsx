import { useEffect, useState } from 'react'
import { apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity } from 'lucide-react'

interface ActivityFeedWidgetProps {
  title: string
  config: Record<string, any>
}

interface ActivityEvent {
  id: string
  event_type: string
  summary: string
  entity_type: string | null
  entity_id: string | null
  created_at: string
}

export function ActivityFeedWidget({ title, config }: ActivityFeedWidgetProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiPost<{ events: ActivityEvent[] }>('dashboard-data', { widget_type: 'activity_feed', config })
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex-1">
                  <p className="text-sm">{event.summary}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{event.event_type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
