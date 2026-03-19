import React from 'react'
import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Send, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WebhookDelivery {
  id: string
  webhook_subscription_id: string
  outbox_event_id: string
  status: 'pending' | 'failed' | 'success' | 'dead_letter'
  attempts: number
  last_status_code?: number
  last_error?: string
  next_attempt_at?: string
  completed_at?: string
  created_at: string
  webhook_subscriptions?: {
    id: string
    url: string
    signing_secret?: string
    enabled: boolean
  }
  outbox_events?: {
    id: string
    event_type: string
    payload: Record<string, any>
    created_at: string
  }
}

const STATUS_COLORS: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  pending: 'secondary',
  failed: 'destructive',
  success: 'default',
  dead_letter: 'destructive',
}

const STATUS_ICONS = {
  pending: Clock,
  failed: XCircle,
  success: CheckCircle,
  dead_letter: AlertCircle,
}

export function WebhookDeliveriesPage() {
  const { currentAccountId } = useAuth()
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null)
  const [filter, setFilter] = useState({
    status: '',
    event_type: '',
    url: '',
  })
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filter.status) params.status = filter.status
      if (filter.event_type) params.event_type = filter.event_type
      if (filter.url) params.url = filter.url
      
      const data = await apiGet<WebhookDelivery[]>('webhook-deliveries', params)
      setDeliveries(data || [])
    } catch { setDeliveries([]) }
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

  async function retryDelivery(id: string) {
    try {
      await apiPost('webhook-deliveries/retry', { id })
      await refresh()
    } catch (err: any) {
      alert(err.message || 'Retry failed')
    }
  }

  function formatPayload(payload: Record<string, any>): string {
    try {
      return JSON.stringify(payload, null, 2)
    } catch {
      return String(payload)
    }
  }

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
    success: deliveries.filter(d => d.status === 'success').length,
    dead_letter: deliveries.filter(d => d.status === 'dead_letter').length,
  }

  const filteredDeliveries = deliveries

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhook Deliveries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor outbound webhook delivery queue, retry failures, and view dead-letter events.
          </p>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
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
            <div className="text-2xl font-bold text-orange-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.dead_letter}</div>
            <p className="text-xs text-muted-foreground">Dead Letter</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={filter.status}
                onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="success">Success</option>
                <option value="dead_letter">Dead Letter</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Event Type</label>
              <Input
                placeholder="e.g. item.created"
                value={filter.event_type}
                onChange={e => setFilter(p => ({ ...p, event_type: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">URL</label>
              <Input
                placeholder="webhook URL"
                value={filter.url}
                onChange={e => setFilter(p => ({ ...p, url: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => setFilter({ status: '', event_type: '', url: '' })}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries List */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filteredDeliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No webhook deliveries found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {filteredDeliveries.map(delivery => (
              <Card 
                key={delivery.id}
                className={cn("cursor-pointer transition-colors", selectedDelivery?.id === delivery.id && "ring-2 ring-primary")}
                onClick={() => setSelectedDelivery(delivery)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={STATUS_COLORS[delivery.status]} className="gap-1">
                          {React.createElement(STATUS_ICONS[delivery.status] as React.ComponentType<{ className?: string }>, { className: "h-3 w-3" })}
                          {delivery.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Attempt {delivery.attempts}
                        </span>
                        {delivery.last_status_code && (
                          <Badge variant="outline" className={cn(
                            delivery.last_status_code >= 200 && delivery.last_status_code < 300 && "text-green-600",
                            delivery.last_status_code >= 400 && "text-red-600"
                          )}>
                            {delivery.last_status_code}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="font-mono text-xs truncate">
                          {delivery.webhook_subscriptions?.url}
                        </p>
                        <p className="text-muted-foreground">
                          Event: <span className="font-mono">{delivery.outbox_events?.event_type}</span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Created: {new Date(delivery.created_at).toLocaleString()}
                        </p>
                        {delivery.next_attempt_at && delivery.status === 'pending' && (
                          <p className="text-muted-foreground text-xs">
                            Next attempt: {new Date(delivery.next_attempt_at).toLocaleString()}
                          </p>
                        )}
                        {delivery.completed_at && delivery.status === 'success' && (
                          <p className="text-muted-foreground text-xs">
                            Completed: {new Date(delivery.completed_at).toLocaleString()}
                          </p>
                        )}
                        {delivery.last_error && (
                          <p className="text-red-600 text-xs truncate">
                            Error: {delivery.last_error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {(delivery.status === 'failed' || delivery.status === 'dead_letter') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            retryDelivery(delivery.id)
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDelivery(delivery)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail Panel */}
          <div className="space-y-4">
            {selectedDelivery ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Delivery Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="font-medium">ID:</span> {selectedDelivery.id}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>
                        <Badge variant={STATUS_COLORS[selectedDelivery.status]} className="ml-2">
                          {selectedDelivery.status}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Attempts:</span> {selectedDelivery.attempts}
                      </div>
                      {selectedDelivery.last_status_code && (
                        <div>
                          <span className="font-medium">Last Status:</span> {selectedDelivery.last_status_code}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Created:</span> {new Date(selectedDelivery.created_at).toLocaleString()}
                      </div>
                      {selectedDelivery.next_attempt_at && (
                        <div>
                          <span className="font-medium">Next Attempt:</span> {new Date(selectedDelivery.next_attempt_at).toLocaleString()}
                        </div>
                      )}
                      {selectedDelivery.completed_at && (
                        <div>
                          <span className="font-medium">Completed:</span> {new Date(selectedDelivery.completed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    {selectedDelivery.last_error && (
                      <div>
                        <span className="font-medium text-sm">Last Error:</span>
                        <div className="mt-1 p-2 rounded bg-red-50 text-red-700 text-sm font-mono">
                          {selectedDelivery.last_error}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Event Payload</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Event Type:</span> {selectedDelivery.outbox_events?.event_type}
                      </div>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                        {selectedDelivery.outbox_events?.payload ? 
                          formatPayload(selectedDelivery.outbox_events.payload) : 
                          'No payload'
                        }
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Webhook URL</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm font-mono break-all">
                      {selectedDelivery.webhook_subscriptions?.url}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Eye className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select a delivery to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
