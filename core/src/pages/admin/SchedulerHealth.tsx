import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PendingInstance {
  id: string
  trigger_id: string
  status: 'pending' | 'fired' | 'failed' | 'cancelled'
  fire_at: string
  created_at: string
  scheduled_triggers?: {
    id: string
    name: string
    trigger_type: string
  }
}

interface RecentFire {
  id: string
  trigger_id: string
  status: 'fired' | 'failed'
  fired_at: string
  result?: Record<string, any>
  error?: string
  scheduled_triggers?: {
    id: string
    name: string
    trigger_type: string
  }
}

interface SchedulerError {
  id: string
  trigger_id: string
  error_message: string
  created_at: string
  scheduled_triggers?: {
    id: string
    name: string
  }
}

export function SchedulerHealthPage() {
  const { currentAccountId } = useAuth()
  const [pendingInstances, setPendingInstances] = useState<PendingInstance[]>([])
  const [recentFires, setRecentFires] = useState<RecentFire[]>([])
  const [errors, setErrors] = useState<SchedulerError[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [pendingRes, firesRes, errorsRes] = await Promise.all([
        apiGet<PendingInstance[]>('scheduler/pending-instances'),
        apiGet<RecentFire[]>('scheduler/recent-fires'),
        apiGet<SchedulerError[]>('scheduler/errors'),
      ])
      setPendingInstances(pendingRes || [])
      setRecentFires(firesRes || [])
      setErrors(errorsRes || [])
    } catch {
      setPendingInstances([])
      setRecentFires([])
      setErrors([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const stats = {
    pending: pendingInstances.length,
    recentFires: recentFires.length,
    errors: errors.length,
    successRate: recentFires.length > 0 
      ? (recentFires.filter(f => f.status === 'fired').length / recentFires.length * 100).toFixed(1)
      : '0'
  }

  const overdueInstances = pendingInstances.filter(instance => 
    new Date(instance.fire_at) < new Date()
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scheduler Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor scheduler performance, pending instances, and execution errors.
          </p>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Health Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{stats.pending}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.recentFires}</div>
                <p className="text-xs text-muted-foreground">Recent Fires</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.successRate}%</div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{stats.errors}</div>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {overdueInstances.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">
                {overdueInstances.length} overdue instance{overdueInstances.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Instances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Instances
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Scheduled triggers waiting to fire
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : pendingInstances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending instances</p>
            ) : (
              <div className="space-y-3">
                {pendingInstances.map(instance => (
                  <div key={instance.id} className={cn(
                    "p-3 rounded border",
                    new Date(instance.fire_at) < new Date() && "border-orange-200 bg-orange-50"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {instance.scheduled_triggers?.name || 'Unknown Trigger'}
                          </h4>
                          {new Date(instance.fire_at) < new Date() && (
                            <Badge variant="outline" className="text-orange-600">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Fires: {new Date(instance.fire_at).toLocaleString()}
                          </p>
                          <p>
                            Created: {new Date(instance.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={instance.status === 'pending' ? 'secondary' : 'outline'}>
                        {instance.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Fires */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Fires
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Recent trigger executions
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : recentFires.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent executions</p>
            ) : (
              <div className="space-y-3">
                {recentFires.map(fire => (
                  <div key={fire.id} className="p-3 rounded border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">
                            {fire.scheduled_triggers?.name || 'Unknown Trigger'}
                          </h4>
                          <Badge variant={fire.status === 'fired' ? 'default' : 'destructive'}>
                            {fire.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Fired: {new Date(fire.fired_at).toLocaleString()}
                          </p>
                          {fire.error && (
                            <p className="text-red-600 truncate">
                              Error: {fire.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Scheduler Errors
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recent scheduler execution errors
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors</p>
          ) : (
            <div className="space-y-3">
              {errors.map(error => (
                <div key={error.id} className="p-3 rounded border border-red-200 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">
                          {error.scheduled_triggers?.name || 'Unknown Trigger'}
                        </h4>
                        <Badge variant="destructive">Error</Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="text-red-700 font-mono text-xs">
                          {error.error_message}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(error.created_at).toLocaleString()}
                        </p>
                      </div>
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
