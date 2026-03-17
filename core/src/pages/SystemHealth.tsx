import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Clock, Webhook, Activity, Server } from 'lucide-react'

interface ErrorEvent {
  id: string
  account_id: string | null
  request_id: string | null
  function_name: string
  error_code: string
  message: string
  created_at: string
}

interface MetricsSnapshot {
  id: string
  period_start: string
  period_end: string
  function_name: string | null
  total_errors: number
  error_codes: Record<string, number>
  scheduler_executed: number
  scheduler_errors: number
  webhook_delivered: number
  webhook_failed: number
}

interface HealthData {
  recentErrors: ErrorEvent[]
  snapshots: MetricsSnapshot[]
  pending: {
    schedulerInstances: number
    webhookDeliveries: number
  }
}

const ERROR_CODE_COLORS: Record<string, string> = {
  auth_failed: 'bg-yellow-100 text-yellow-800',
  forbidden: 'bg-orange-100 text-orange-800',
  not_found: 'bg-gray-100 text-gray-800',
  validation: 'bg-blue-100 text-blue-800',
  db_error: 'bg-red-100 text-red-800',
  timeout: 'bg-purple-100 text-purple-800',
  external_service: 'bg-pink-100 text-pink-800',
  internal: 'bg-red-100 text-red-800',
}

export function SystemHealthPage() {
  const { profile } = useAuth()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  const isSystemAdmin = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<HealthData>('system-health', { hours: '24' })
        setData(result)
      } catch (err) {
        console.error('Failed to load system health:', err)
      } finally {
        setLoading(false)
      }
    }
    if (isSystemAdmin) load()
  }, [isSystemAdmin])

  if (!isSystemAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">System admin access required.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading health data...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Failed to load health data.</p>
      </div>
    )
  }

  // Aggregate system-level snapshots
  const systemSnapshots = data.snapshots.filter(s => s.function_name === '_system')
  const totalErrors24h = systemSnapshots.reduce((sum, s) => sum + s.total_errors, 0)
  const totalSchedulerExec = systemSnapshots.reduce((sum, s) => sum + s.scheduler_executed, 0)
  const totalSchedulerErr = systemSnapshots.reduce((sum, s) => sum + s.scheduler_errors, 0)
  const totalWebhookOk = systemSnapshots.reduce((sum, s) => sum + s.webhook_delivered, 0)
  const totalWebhookFail = systemSnapshots.reduce((sum, s) => sum + s.webhook_failed, 0)
  const webhookTotal = totalWebhookOk + totalWebhookFail
  const webhookSuccessRate = webhookTotal > 0 ? Math.round((totalWebhookOk / webhookTotal) * 100) : 100

  // Error rate by hour for the bar chart
  const hourlyErrors = systemSnapshots.map(s => ({
    hour: new Date(s.period_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    errors: s.total_errors,
  }))

  // Max bar height for scaling
  const maxErrors = Math.max(...hourlyErrors.map(h => h.errors), 1)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-sm text-muted-foreground">Last 24 hours</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors (24h)</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${totalErrors24h > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErrors24h}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Scheduler</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSchedulerExec}</div>
            <p className="text-xs text-muted-foreground">
              {totalSchedulerErr > 0 ? (
                <span className="text-red-500">{totalSchedulerErr} errors</span>
              ) : (
                'No errors'
              )}
              {' · '}{data.pending.schedulerInstances} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhookSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totalWebhookOk} delivered · {totalWebhookFail} failed · {data.pending.webhookDeliveries} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {totalErrors24h === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalErrors24h === 0 ? 'Healthy' : 'Degraded'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error rate chart */}
      {hourlyErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Error Rate by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {hourlyErrors.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${h.errors > 0 ? 'bg-red-400' : 'bg-muted'}`}
                    style={{ height: Math.max((h.errors / maxErrors) * 100, 2) }}
                    title={`${h.hour}: ${h.errors} errors`}
                  />
                  {i % Math.max(Math.floor(hourlyErrors.length / 6), 1) === 0 && (
                    <span className="text-[10px] text-muted-foreground">{h.hour}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent errors table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Recent Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors in the last 24 hours.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Time</th>
                    <th className="pb-2 pr-4 font-medium">Function</th>
                    <th className="pb-2 pr-4 font-medium">Code</th>
                    <th className="pb-2 pr-4 font-medium">Message</th>
                    <th className="pb-2 font-medium">Request ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentErrors.map((err) => (
                    <tr key={err.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                        {new Date(err.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 pr-4">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{err.function_name}</code>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className={ERROR_CODE_COLORS[err.error_code] || ''}>
                          {err.error_code}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 max-w-xs truncate">{err.message}</td>
                      <td className="py-2">
                        <code className="text-xs text-muted-foreground">{err.request_id?.slice(0, 8) || '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-function breakdown */}
      {data.snapshots.filter(s => s.function_name !== '_system' && s.total_errors > 0).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4" />
              Errors by Function (Latest Hour)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.snapshots
                .filter(s => s.function_name !== '_system' && s.total_errors > 0)
                .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime())
                .slice(0, 20)
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <code className="text-sm">{s.function_name}</code>
                    <div className="flex items-center gap-2">
                      {Object.entries(s.error_codes).map(([code, count]) => (
                        <Badge key={code} variant="secondary" className={ERROR_CODE_COLORS[code] || ''}>
                          {code}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
