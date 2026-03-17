import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Key, ArrowDownToLine, Trash2, Power, Copy, Check, Pencil } from 'lucide-react'

const ACTION_TYPES = [
  { value: 'transition_item', label: 'Transition Workflow Item' },
  { value: 'update_item_field', label: 'Update Item Field(s)' },
  { value: 'create_item', label: 'Create Workflow Item' },
  { value: 'emit_event', label: 'Emit Outbox Event' },
]

export function InboundWebhooksPage() {
  const { currentAccountId } = useAuth()
  const [tab, setTab] = useState<'keys' | 'mappings'>('keys')
  const [keys, setKeys] = useState<any[]>([])
  const [mappings, setMappings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showNewMapping, setShowNewMapping] = useState(false)
  const [mapName, setMapName] = useState('')
  const [mapEventName, setMapEventName] = useState('')
  const [mapAction, setMapAction] = useState('transition_item')
  const [mapConfig, setMapConfig] = useState('{}')
  const [editingMapping, setEditingMapping] = useState<any>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { if (currentAccountId) loadData() }, [currentAccountId])

  async function loadData() {
    setLoading(true)
    try {
      const [k, m] = await Promise.all([apiGet<any[]>('inbound-webhook-keys'), apiGet<any[]>('inbound-webhook-mappings')])
      setKeys(k); setMappings(m)
    } catch {}
    setLoading(false)
  }

  async function createKey() {
    if (!newKeyName.trim()) return
    await apiPost('inbound-webhook-keys', { name: newKeyName })
    setNewKeyName(''); setShowNewKey(false); loadData()
  }

  async function toggleKey(k: any) { await apiPatch('inbound-webhook-keys', { enabled: !k.enabled }, { id: k.id }); loadData() }
  async function deleteKey(id: string) { await apiDelete(`inbound-webhook-keys?id=${id}`); loadData() }
  async function toggleMapping(m: any) { await apiPatch('inbound-webhook-mappings', { enabled: !m.enabled }, { id: m.id }); loadData() }
  async function deleteMapping(id: string) { await apiDelete(`inbound-webhook-mappings?id=${id}`); loadData() }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
  }

  function resetMappingForm() {
    setMapName(''); setMapEventName(''); setMapAction('transition_item'); setMapConfig('{}')
    setShowNewMapping(false); setEditingMapping(null)
  }

  function startEditMapping(m: any) {
    setEditingMapping(m); setMapName(m.name); setMapEventName(m.event_name)
    setMapAction(m.action); setMapConfig(JSON.stringify(m.action_config, null, 2))
    setShowNewMapping(false)
  }

  async function saveMapping() {
    if (!mapName.trim() || !mapEventName.trim()) return
    let cfg = {}; try { cfg = JSON.parse(mapConfig) } catch {}
    if (editingMapping) {
      await apiPatch('inbound-webhook-mappings', { name: mapName, event_name: mapEventName, action: mapAction, action_config: cfg }, { id: editingMapping.id })
    } else {
      await apiPost('inbound-webhook-mappings', { name: mapName, event_name: mapEventName, action: mapAction, action_config: cfg })
    }
    resetMappingForm(); loadData()
  }

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/.netlify/functions/inbound-webhooks` : '/.netlify/functions/inbound-webhooks'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbound Webhooks</h1>
        <p className="mt-1 text-muted-foreground">Accept events from external systems like Make.com</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-medium mb-1">Webhook Endpoint</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">POST {webhookUrl}</code>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(webhookUrl, 'url')}>
              {copiedId === 'url' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Header: <code className="text-[10px]">X-Api-Key: your_key</code> &nbsp;|&nbsp;
            Body: <code className="text-[10px]">{`{"event":"name","payload":{...}}`}</code>
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant={tab === 'keys' ? 'default' : 'outline'} size="sm" onClick={() => setTab('keys')}><Key className="mr-1 h-3 w-3" /> API Keys</Button>
        <Button variant={tab === 'mappings' ? 'default' : 'outline'} size="sm" onClick={() => setTab('mappings')}><ArrowDownToLine className="mr-1 h-3 w-3" /> Event Mappings</Button>
      </div>

      {tab === 'keys' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewKey(true)}><Plus className="mr-1 h-3 w-3" /> New API Key</Button>
          </div>
          {showNewKey && (
            <Card><CardContent className="flex items-center gap-3 pt-6">
              <Input placeholder="Key name (e.g. Make.com)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createKey()} />
              <Button onClick={createKey} disabled={!newKeyName.trim()}>Create</Button>
              <Button variant="ghost" onClick={() => { setShowNewKey(false); setNewKeyName('') }}>Cancel</Button>
            </CardContent></Card>
          )}
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : keys.map((k: any) => (
            <Card key={k.id} className={!k.enabled ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 py-4">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{k.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{k.api_key.slice(0, 12)}...{k.api_key.slice(-6)}</code>
                    <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => copyToClipboard(k.api_key, k.id)}>
                      {copiedId === k.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  {k.last_used_at && <p className="text-[10px] text-muted-foreground mt-1">Last used: {new Date(k.last_used_at).toLocaleString()}</p>}
                </div>
                <Badge variant={k.enabled ? 'default' : 'secondary'}>{k.enabled ? 'Active' : 'Disabled'}</Badge>
                <Button variant="outline" size="sm" onClick={() => toggleKey(k)}><Power className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteKey(k.id)}><Trash2 className="h-3 w-3" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'mappings' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setShowNewMapping(true); setEditingMapping(null); setMapName(''); setMapEventName(''); setMapAction('transition_item'); setMapConfig('{}') }}>
              <Plus className="mr-1 h-3 w-3" /> New Mapping
            </Button>
          </div>
          {(showNewMapping || editingMapping) && (
            <Card>
              <CardHeader><CardTitle className="text-lg">{editingMapping ? 'Edit' : 'New'} Mapping</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Name</label>
                    <Input value={mapName} onChange={e => setMapName(e.target.value)} placeholder="e.g. Deploy Complete" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Event Name</label>
                    <Input value={mapEventName} onChange={e => setMapEventName(e.target.value)} placeholder="e.g. deploy.completed" className="font-mono text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Action</label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={mapAction} onChange={e => setMapAction(e.target.value)}>
                    {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Action Config (JSON)</label>
                  <textarea className="flex min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" value={mapConfig} onChange={e => setMapConfig(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground">
                    {mapAction === 'transition_item' && 'Keys: item_id_field, transition_name or target_stage_name or target_stage_id'}
                    {mapAction === 'update_item_field' && 'Keys: item_id_field, field_updates: {"field": "value or {{payload.x}}"}'}
                    {mapAction === 'create_item' && 'Keys: workflow_definition_id, workflow_type, title_template, priority'}
                    {mapAction === 'emit_event' && 'Keys: event_type, entity_type, entity_id'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveMapping} disabled={!mapName.trim() || !mapEventName.trim()}>{editingMapping ? 'Save' : 'Create'}</Button>
                  <Button variant="ghost" onClick={resetMappingForm}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : mappings.length === 0 && !showNewMapping ? (
            <p className="text-sm text-muted-foreground">No event mappings. Create one to define what happens when an external event arrives.</p>
          ) : mappings.map((m: any) => (
            <Card key={m.id} className={!m.enabled ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 py-4">
                <ArrowDownToLine className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{m.event_name}</span> → {ACTION_TYPES.find(a => a.value === m.action)?.label || m.action}
                  </p>
                </div>
                <Badge variant={m.enabled ? 'default' : 'secondary'}>{m.enabled ? 'Active' : 'Off'}</Badge>
                <Button variant="ghost" size="sm" onClick={() => startEditMapping(m)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="outline" size="sm" onClick={() => toggleMapping(m)}><Power className="h-3 w-3" /></Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMapping(m.id)}><Trash2 className="h-3 w-3" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
