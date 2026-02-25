import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, GitBranch, Building2, Users, FileText } from 'lucide-react'
import { MetricWidget } from '@/components/dashboard/MetricWidget'
import { TableWidget } from '@/components/dashboard/TableWidget'
import { PipelineWidget } from '@/components/dashboard/PipelineWidget'
import { ChartWidget } from '@/components/dashboard/ChartWidget'
import { ActivityFeedWidget } from '@/components/dashboard/ActivityFeedWidget'

interface DashboardWidget {
  id: string
  widget_type: string
  title: string
  config: Record<string, any>
  position: Record<string, any>
}

interface DashboardDef {
  id: string
  title: string
  widgets: DashboardWidget[]
}

function WidgetRenderer({ widget }: { widget: DashboardWidget }) {
  switch (widget.widget_type) {
    case 'metric':
      return <MetricWidget title={widget.title} config={widget.config} />
    case 'table':
      return <TableWidget title={widget.title} config={widget.config} />
    case 'pipeline':
      return <PipelineWidget title={widget.title} config={widget.config} />
    case 'chart':
      return <ChartWidget title={widget.title} config={widget.config} />
    case 'activity_feed':
      return <ActivityFeedWidget title={widget.title} config={widget.config} />
    default:
      return (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Unknown widget type: {widget.widget_type}
          </CardContent>
        </Card>
      )
  }
}

function ConfiguredDashboard({ dashboard }: { dashboard: DashboardDef }) {
  const widgets = [...dashboard.widgets].sort((a, b) => {
    const ay = a.position?.y ?? 0
    const by = b.position?.y ?? 0
    if (ay !== by) return ay - by
    return (a.position?.x ?? 0) - (b.position?.x ?? 0)
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{dashboard.title}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.filter((w) => w.widget_type === 'metric').map((w) => (
          <WidgetRenderer key={w.id} widget={w} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {widgets.filter((w) => w.widget_type !== 'metric').map((w) => (
          <WidgetRenderer key={w.id} widget={w} />
        ))}
      </div>
    </div>
  )
}

function FallbackDashboard() {
  const { profile, currentAccountId } = useAuth()
  const [activity, setActivity] = useState<any[]>([])
  const [counts, setCounts] = useState({ accounts: 0, persons: 0, workflows: 0, documents: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    Promise.all([
      apiGet<any[]>('activity-events', { limit: '10' }),
      apiGet<any[]>('accounts'),
      apiGet<any[]>('persons'),
      apiGet<any[]>('workflow-definitions'),
      apiGet<any[]>('kb-articles'),
    ])
      .then(([actData, acctData, pplData, wfData, kbData]) => {
        setActivity(actData)
        setCounts({
          accounts: acctData.length,
          persons: pplData.length,
          workflows: wfData.length,
          documents: kbData.length,
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
            <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.accounts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Persons</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.persons}</p>
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{counts.documents}</p>
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

export function DashboardPage() {
  const { currentAccountId } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardDef | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!currentAccountId) return
    apiGet<DashboardDef | null>('dashboards', { default: 'true' })
      .then((data) => setDashboard(data && data.widgets?.length ? data : null))
      .catch(() => setDashboard(null))
      .finally(() => setChecked(true))
  }, [currentAccountId])

  if (!checked) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    )
  }

  if (dashboard) {
    return <ConfiguredDashboard dashboard={dashboard} />
  }

  return <FallbackDashboard />
}
