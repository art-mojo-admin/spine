import React from 'react'
import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Activity, RefreshCw, CheckCircle, XCircle, Clock, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutomationExecution {
  id: string
  automation_rule_id: string
  event_type: string
  trigger_context: Record<string, any>
  conditions_met: boolean
  actions_executed: number
  execution_result?: Record<string, any>
  error?: string
  execution_time_ms?: number
  created_at: string
  automation_rules?: {
    id: string
    name: string
    trigger_event: string
    enabled: boolean
  }
}

const STATUS_ICONS = {
  success: CheckCircle,
  failed: XCircle,
  skipped: Clock,
}

const STATUS_COLORS: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  success: 'default',
  failed: 'destructive',
  skipped: 'secondary',
}

export function AutomationLogPage() {
  const { currentAccountId } = useAuth()
  const [executions, setExecutions] = useState<AutomationExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExecution, setSelectedExecution] = useState<AutomationExecution | null>(null)
  const [filter, setFilter] = useState({
    event_type: '',
    rule_name: '',
    status: '',
  })
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filter.event_type) params.event_type = filter.event_type
      if (filter.rule_name) params.rule_name = filter.rule_name
      if (filter.status) params.status = filter.status
      
      const data = await apiGet<AutomationExecution[]>('automation-executions', params)
      setExecutions(data || [])
    } catch { setExecutions([]) }
    setLoading(false)
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId, filter])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function getStatus(execution: AutomationExecution): 'success' | 'failed' | 'skipped' {
    if (!execution.conditions_met) return 'skipped'
    if (execution.error) return 'failed'
    return 'success'
  }

  function formatContext(context: Record<string, any>): string {
    try {
      return JSON.stringify(context, null, 2)
    } catch {
      return String(context)
    }
  }

  const stats = executions.reduce((acc, exec) => {
    const status = getStatus(exec)
    acc[status] = (acc[status] || 0) + 1
    acc.total++
    return acc
  }, { total: 0, success: 0, failed: 0, skipped: 0 })

  const uniqueRules = [...new Set(executions.map(e => e.automation_rules?.name).filter(Boolean))]
  const uniqueEvents = [...new Set(executions.map(e => e.event_type).filter(Boolean))]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automation Execution Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View automation rule execution history and performance metrics.
          </p>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Executions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            <p className="text-xs text-muted-foreground">Success</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.skipped}</div>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Event Type</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={filter.event_type}
                onChange={e => setFilter(p => ({ ...p, event_type: e.target.value }))}
              >
                <option value="">All events</option>
                {uniqueEvents.map(event => (
                  <option key={event} value={event}>{event}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rule Name</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={filter.rule_name}
                onChange={e => setFilter(p => ({ ...p, rule_name: e.target.value }))}
              >
                <option value="">All rules</option>
                {uniqueRules.map(rule => (
                  <option key={rule} value={rule}>{rule}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={filter.status}
                onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => setFilter({ event_type: '', rule_name: '', status: '' })}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executions List */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No automation executions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {executions.map(execution => {
              const status = getStatus(execution)
              const StatusIcon = STATUS_ICONS[status]
              
              return (
                <Card 
                  key={execution.id}
                  className={cn("cursor-pointer transition-colors", selectedExecution?.id === execution.id && "ring-2 ring-primary")}
                  onClick={() => setSelectedExecution(execution)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={STATUS_COLORS[status]} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {execution.actions_executed} action{execution.actions_executed !== 1 ? 's' : ''}
                          </span>
                          {execution.execution_time_ms && (
                            <span className="text-xs text-muted-foreground">
                              {execution.execution_time_ms}ms
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium truncate">
                            {execution.automation_rules?.name || 'Unknown Rule'}
                          </p>
                          <p className="text-muted-foreground">
                            Event: <span className="font-mono">{execution.event_type}</span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(execution.created_at).toLocaleString()}
                          </p>
                          {execution.error && (
                            <p className="text-red-600 text-xs truncate">
                              Error: {execution.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedExecution(execution)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Detail Panel */}
          <div className="space-y-4">
            {selectedExecution ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Execution Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="font-medium">Rule:</span> {selectedExecution.automation_rules?.name}
                      </div>
                      <div>
                        <span className="font-medium">Event:</span> {selectedExecution.event_type}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>
                        <Badge variant={STATUS_COLORS[getStatus(selectedExecution)]} className="ml-2">
                          {getStatus(selectedExecution)}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Conditions Met:</span> {selectedExecution.conditions_met ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Actions Executed:</span> {selectedExecution.actions_executed}
                      </div>
                      {selectedExecution.execution_time_ms && (
                        <div>
                          <span className="font-medium">Execution Time:</span> {selectedExecution.execution_time_ms}ms
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Timestamp:</span> {new Date(selectedExecution.created_at).toLocaleString()}
                      </div>
                    </div>
                    {selectedExecution.error && (
                      <div>
                        <span className="font-medium text-sm">Error:</span>
                        <div className="mt-1 p-2 rounded bg-red-50 text-red-700 text-sm font-mono">
                          {selectedExecution.error}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Trigger Context</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                      {formatContext(selectedExecution.trigger_context)}
                    </pre>
                  </CardContent>
                </Card>

                {selectedExecution.execution_result && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Execution Result</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                        {formatContext(selectedExecution.execution_result)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Eye className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select an execution to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
