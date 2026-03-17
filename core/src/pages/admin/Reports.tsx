import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { BarChart3, Users, Package, Activity, Webhook } from 'lucide-react'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

interface ReportData {
  itemsByType: Record<string, number>
  stageBreakdown: Record<string, Record<string, number>>
  activityByDay: { date: string; count: number }[]
  totals: { persons: number; members: number; items: number }
  webhooks: { success: number; failed: number }
}

export function ReportsPage() {
  const { currentAccountId } = useAuth()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    apiGet<ReportData>('admin-reports')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [currentAccountId])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading reports...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Unable to load report data.</p>
      </div>
    )
  }

  const pieData = Object.entries(data.itemsByType).map(([name, value]) => ({ name, value }))
  const totalWebhooks = data.webhooks.success + data.webhooks.failed

  // Build stage breakdown bar chart data for the top item types
  const topTypes = Object.entries(data.itemsByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type]) => type)

  const stageChartData: any[] = []
  for (const type of topTypes) {
    const stages = data.stageBreakdown[type] || {}
    for (const [stage, count] of Object.entries(stages)) {
      stageChartData.push({ type, stage, count })
    }
  }

  // Group stage data by type for stacked display
  const stageByType = topTypes.map((type) => {
    const stages = data.stageBreakdown[type] || {}
    return { type, ...stages, total: Object.values(stages).reduce((s, v) => s + v, 0) }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">Tenant analytics and activity overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4" /> Total Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totals.items}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" /> Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totals.members}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" /> Activity (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.activityByDay.reduce((s, d) => s + d.count, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Webhook className="h-4 w-4" /> Webhooks (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{totalWebhooks}</p>
              {totalWebhooks > 0 && (
                <span className="text-sm text-muted-foreground mb-1">
                  {Math.round((data.webhooks.success / totalWebhooks) * 100)}% success
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity over time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.activityByDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.substring(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Events" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Items by type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" /> Items by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No items yet</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{entry.name}</span>
                      <Badge variant="secondary" className="ml-auto text-[10px]">{entry.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items by stage */}
        {stageByType.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" /> Items by Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topTypes.map((type) => {
                  const stages = data.stageBreakdown[type] || {}
                  return (
                    <div key={type} className="rounded-md border p-3">
                      <p className="text-sm font-medium mb-2">{type}</p>
                      <div className="space-y-1">
                        {Object.entries(stages).map(([stage, count]) => (
                          <div key={stage} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{stage}</span>
                            <Badge variant="outline" className="text-[10px]">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
