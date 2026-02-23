import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, GitBranch, TicketCheck, BookOpen } from 'lucide-react'

export function DashboardPage() {
  const { profile, currentAccountId } = useAuth()
  const [activity, setActivity] = useState<any[]>([])
  const [counts, setCounts] = useState({ workflows: 0, tickets: 0, articles: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    Promise.all([
      apiGet<any[]>('activity-events', { limit: '10' }),
      apiGet<any[]>('workflow-definitions'),
      apiGet<any[]>('tickets'),
      apiGet<any[]>('kb-articles'),
    ])
      .then(([actData, wfData, tkData, kbData]) => {
        setActivity(actData)
        setCounts({
          workflows: wfData.length,
          tickets: tkData.filter((t: any) => t.status !== 'closed').length,
          articles: kbData.length,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back, {profile?.display_name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Workflows</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.workflows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <TicketCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.tickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">KB Articles</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.articles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activity.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activity.map((event: any) => (
                <div key={event.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm">{event.summary}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{event.event_type}</Badge>
                      <span className="text-xs text-muted-foreground">
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
    </div>
  )
}
