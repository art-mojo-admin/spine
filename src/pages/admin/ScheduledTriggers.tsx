import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Clock, Repeat, Timer, X, Play, Ban } from 'lucide-react'

type Tab = 'triggers' | 'instances'

const TRIGGER_TYPES = [
  { value: 'one_time', label: 'One-Time', icon: Clock },
  { value: 'recurring', label: 'Recurring', icon: Repeat },
  { value: 'countdown', label: 'Countdown', icon: Timer },
]

const ACTION_TYPES = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'create_entity', label: 'Create Entity' },
  { value: 'send_notification', label: 'Send Notification' },
]

const COMMON_EVENTS = [
  'item.created', 'item.updated', 'item.stage_changed',
  'kb.created', 'kb.updated',
  'user.signed_up',
]

export function ScheduledTriggersPage() {
  const { currentAccountId } = useAuth()
  const [tab, setTab] = useState<Tab>('triggers')
  const [triggers, setTriggers] = useState<any[]>([])
  const [instances, setInstances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<any | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState('one_time')
  const [fireAt, setFireAt] = useState('')
  const [cronExpression, setCronExpression] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(900)
  const [delayEvent, setDelayEvent] = useState('')
  const [actionType, setActionType] = useState('webhook')
  const [actionConfigJson, setActionConfigJson] = useState('{}')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    loadData()
  }, [currentAccountId])

  async function loadData() {
    setLoading(true)
    try {
      const [t, i] = await Promise.all([
        apiGet<any[]>('scheduled-triggers'),
        apiGet<any[]>('scheduled-trigger-instances'),
      ])
      setTriggers(t || [])
      setInstances(i || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setName('')
    setTriggerType('one_time')
    setFireAt('')
    setCronExpression('')
    setDelaySeconds(900)
    setDelayEvent('')
    setActionType('webhook')
    setActionConfigJson('{}')
    setEnabled(true)
    setEditingTrigger(null)
    setShowForm(false)
  }

  function openEdit(trigger: any) {
    setName(trigger.name)
    setTriggerType(trigger.trigger_type)
    setFireAt(trigger.fire_at ? trigger.fire_at.slice(0, 16) : '')
    setCronExpression(trigger.cron_expression || '')
    setDelaySeconds(trigger.delay_seconds || 900)
    setDelayEvent(trigger.delay_event || '')
    setActionType(trigger.action_type)
    setActionConfigJson(JSON.stringify(trigger.action_config || {}, null, 2))
    setEnabled(trigger.enabled)
    setEditingTrigger(trigger)
    setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim()) return

    let actionConfig: any = {}
    try { actionConfig = JSON.parse(actionConfigJson) } catch { return }

    const payload: any = {
      name,
      trigger_type: triggerType,
      action_type: actionType,
      action_config: actionConfig,
      enabled,
    }

    if (triggerType === 'one_time') {
      if (!fireAt) return
      payload.fire_at = new Date(fireAt).toISOString()
    } else if (triggerType === 'recurring') {
      if (!cronExpression.trim()) return
      payload.cron_expression = cronExpression
    } else if (triggerType === 'countdown') {
      if (!delaySeconds || !delayEvent) return
      payload.delay_seconds = delaySeconds
      payload.delay_event = delayEvent
    }

    try {
      if (editingTrigger) {
        await apiPatch('scheduled-triggers', payload, { id: editingTrigger.id })
      } else {
        await apiPost('scheduled-triggers', payload)
      }
      resetForm()
      await loadData()
    } catch (err: any) {
      console.error('Save failed:', err)
    }
  }

  async function handleDelete(id: string) {
    await apiDelete('scheduled-triggers', { id })
    await loadData()
  }

  async function handleToggle(trigger: any) {
    await apiPatch('scheduled-triggers', { enabled: !trigger.enabled }, { id: trigger.id })
    await loadData()
  }

  async function handleCancelInstance(id: string) {
    await apiPatch('scheduled-trigger-instances', { status: 'cancelled' }, { id })
    await loadData()
  }

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleString()
  }

  const typeBadge = (t: string) => {
    const colors: Record<string, string> = {
      one_time: 'bg-blue-100 text-blue-800',
      recurring: 'bg-purple-100 text-purple-800',
      countdown: 'bg-amber-100 text-amber-800',
    }
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[t] || ''}`}>{t.replace('_', '-')}</span>
  }

  const statusBadge = (s: string) => {
    const variant = s === 'fired' ? 'default' : s === 'pending' ? 'secondary' : s === 'cancelled' ? 'outline' : 'destructive'
    return <Badge variant={variant} className="text-[10px]">{s}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduled Triggers</h1>
          <p className="mt-1 text-muted-foreground">Timed, recurring, and countdown triggers</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Trigger
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['triggers', 'instances'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'triggers' ? 'Triggers' : 'Execution Log'}
          </button>
        ))}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingTrigger ? 'Edit Trigger' : 'New Trigger'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly Export" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Trigger Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  disabled={!!editingTrigger}
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type-specific fields */}
            {triggerType === 'one_time' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Fire At (UTC)</label>
                <Input type="datetime-local" value={fireAt} onChange={(e) => setFireAt(e.target.value)} />
              </div>
            )}

            {triggerType === 'recurring' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Cron Expression</label>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="*/15 * * * *  or  0 0 * * 1"
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day month weekday (UTC). Examples: <code>*/15 * * * *</code> = every 15 min, <code>0 0 * * 1</code> = every Monday midnight
                </p>
              </div>
            )}

            {triggerType === 'countdown' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Delay (seconds)</label>
                  <Input
                    type="number"
                    min={1}
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {delaySeconds >= 86400
                      ? `${(delaySeconds / 86400).toFixed(1)} days`
                      : delaySeconds >= 3600
                      ? `${(delaySeconds / 3600).toFixed(1)} hours`
                      : `${(delaySeconds / 60).toFixed(0)} minutes`}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Trigger Event</label>
                  <Input
                    value={delayEvent}
                    onChange={(e) => setDelayEvent(e.target.value)}
                    placeholder="e.g. ticket.created"
                    list="common-events"
                  />
                  <datalist id="common-events">
                    {COMMON_EVENTS.map((e) => <option key={e} value={e} />)}
                  </datalist>
                </div>
              </div>
            )}

            {/* Action config */}
            <div className="border-t pt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Action Type</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                    Enabled
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Action Config (JSON)</label>
                <Textarea
                  rows={4}
                  className="font-mono text-xs"
                  value={actionConfigJson}
                  onChange={(e) => setActionConfigJson(e.target.value)}
                  placeholder='{"url": "https://hook.make.com/..."}'
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
                {editingTrigger ? 'Update Trigger' : 'Create Trigger'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Triggers List */}
      {tab === 'triggers' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : triggers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No triggers configured</p>
          ) : (
            triggers.map((t) => {
              const TypeIcon = TRIGGER_TYPES.find((tt) => tt.value === t.trigger_type)?.icon || Clock
              return (
                <Card key={t.id} className={!t.enabled ? 'opacity-60' : ''}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <TypeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{t.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {typeBadge(t.trigger_type)}
                        <span>{t.action_type}</span>
                        {t.trigger_type === 'recurring' && <span className="font-mono">{t.cron_expression}</span>}
                        {t.trigger_type === 'countdown' && <span>{t.delay_seconds}s after {t.delay_event}</span>}
                        {t.trigger_type === 'one_time' && <span>at {formatDate(t.fire_at)}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        {t.next_fire_at && <span>Next: {formatDate(t.next_fire_at)}</span>}
                        {t.last_fired_at && <span>Last: {formatDate(t.last_fired_at)}</span>}
                        <span>Runs: {t.fire_count}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleToggle(t)}
                    >
                      {t.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => openEdit(t)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Execution Log / Instances */}
      {tab === 'instances' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No execution history</p>
          ) : (
            instances.map((inst) => (
              <Card key={inst.id}>
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    {inst.status === 'fired' ? <Play className="h-4 w-4 text-green-600" /> :
                     inst.status === 'pending' ? <Clock className="h-4 w-4 text-amber-600" /> :
                     inst.status === 'cancelled' ? <Ban className="h-4 w-4 text-muted-foreground" /> :
                     <X className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {inst.trigger?.name || inst.action_type || 'Timer'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>Fire at: {formatDate(inst.fire_at)}</span>
                      {inst.fired_at && <span>Fired: {formatDate(inst.fired_at)}</span>}
                      {inst.result?.detail && <span>{inst.result.detail}</span>}
                    </div>
                  </div>
                  {statusBadge(inst.status)}
                  {inst.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => handleCancelInstance(inst.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
