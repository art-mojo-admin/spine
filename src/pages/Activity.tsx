import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export function ActivityPage() {
  const { currentAccountId, currentAccountNodeId } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    apiGet<any[]>('activity-events', { limit: '100' })
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId, currentAccountNodeId])

  const filtered = filter
    ? events.filter((e: any) => e.event_type.includes(filter) || e.summary.toLowerCase().includes(filter.toLowerCase()))
    : events

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
        <p className="mt-1 text-muted-foreground">Recent activity across your account</p>
      </div>

      <Input placeholder="Filter by event type or keyword..." value={filter} onChange={e => setFilter(e.target.value)} className="max-w-md" />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity found</p>
          ) : (
            <div className="space-y-4">
              {filtered.map((event: any) => (
                <div key={event.id} className="flex items-start gap-4 border-b pb-4 last:border-0 last:pb-0">
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{event.summary}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{event.event_type}</Badge>
                      {event.entity_type && <span className="text-xs text-muted-foreground">{event.entity_type}</span>}
                      {event.persons && <span className="text-xs text-muted-foreground">by {event.persons.full_name}</span>}
                      <span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
