import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, RefreshCw, Webhook } from 'lucide-react'

export function WebhooksPage() {
  const { currentAccountId } = useAuth()
  const [subs, setSubs] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [tab, setTab] = useState<'subscriptions' | 'deliveries'>('subscriptions')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    loadData()
  }, [currentAccountId])

  async function loadData() {
    setLoading(true)
    try {
      const [s, d] = await Promise.all([
        apiGet<any[]>('webhook-subscriptions'),
        apiGet<any[]>('webhook-deliveries'),
      ])
      setSubs(s)
      setDeliveries(d)
    } catch {}
    setLoading(false)
  }

  async function createSub() {
    if (!newUrl.trim()) return
    await apiPost('webhook-subscriptions', { url: newUrl })
    setNewUrl('')
    setShowCreate(false)
    loadData()
  }

  async function toggleSub(sub: any) {
    await apiPatch('webhook-subscriptions', { enabled: !sub.enabled }, { id: sub.id })
    loadData()
  }

  async function deleteSub(id: string) {
    await apiDelete(`webhook-subscriptions?id=${id}`)
    loadData()
  }

  async function replay(id: string) {
    await apiPost(`webhook-deliveries?id=${id}`, {})
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-muted-foreground">Manage webhook subscriptions and deliveries</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Subscription
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'subscriptions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('subscriptions')}>Subscriptions</Button>
        <Button variant={tab === 'deliveries' ? 'default' : 'outline'} size="sm" onClick={() => setTab('deliveries')}>Deliveries</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Input placeholder="https://example.com/webhook" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            <Button onClick={createSub}>Create</Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : tab === 'subscriptions' ? (
        <div className="grid gap-3">
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions</p>
          ) : subs.map((sub: any) => (
            <Card key={sub.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Webhook className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{sub.url}</p>
                  <p className="text-xs text-muted-foreground font-mono">{sub.id}</p>
                </div>
                <Badge variant={sub.enabled ? 'default' : 'secondary'}>{sub.enabled ? 'Active' : 'Disabled'}</Badge>
                <Button variant="outline" size="sm" onClick={() => toggleSub(sub)}>{sub.enabled ? 'Disable' : 'Enable'}</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSub(sub.id)}>Delete</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries</p>
          ) : deliveries.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.outbox_events?.event_type || '—'}</p>
                  <p className="text-xs text-muted-foreground">Attempts: {d.attempts} • {new Date(d.created_at).toLocaleString()}</p>
                  {d.last_error && <p className="text-xs text-destructive mt-1">{d.last_error}</p>}
                </div>
                <Badge variant={d.status === 'success' ? 'default' : d.status === 'dead_letter' ? 'destructive' : 'secondary'}>{d.status}</Badge>
                {(d.status === 'failed' || d.status === 'dead_letter') && (
                  <Button variant="outline" size="sm" onClick={() => replay(d.id)}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Replay
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
