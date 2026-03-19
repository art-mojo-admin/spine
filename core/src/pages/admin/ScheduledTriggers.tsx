import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, Clock, Play, Pause, Calendar, Repeat, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduledTrigger {
  id: string
  account_id: string
  name: string
  trigger_type: 'one_time' | 'recurring' | 'countdown'
  action_type: string
  action_config: Record<string, any>
  conditions: any[]
  enabled: boolean
  fire_at?: string
  cron_expression?: string
  next_fire_at?: string
  delay_seconds?: number
  delay_event?: string
  fire_count: number
  last_fired_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

interface ScheduledTriggerInstance {
  id: string
  account_id: string
  trigger_id?: string
  action_type: string
  action_config: Record<string, any>
  context?: Record<string, any>
  status: 'pending' | 'fired' | 'failed' | 'cancelled'
  fire_at: string
  fired_at?: string
  result?: Record<string, any>
  created_at: string
}

const ACTION_TYPES = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'create_entity', label: 'Create Entity' },
  { value: 'send_notification', label: 'Send Notification' },
]

const COMMON_EVENTS = [
  'item.created',
  'item.updated',
  'item.stage_changed',
  'thread.created',
]

function formatCron(cron: string): string {
  // Simple cron formatter - could be enhanced with a library
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron
  const [minute, hour, day, month, weekday] = parts
  if (cron === '0 9 * * 1-5') return 'Weekdays at 9:00 AM'
  if (cron === '0 0 * * *') return 'Daily at midnight'
  if (cron === '0 */6 * * *') return 'Every 6 hours'
  if (cron === '*/5 * * * *') return 'Every 5 minutes'
  return `At ${hour}:${minute} on day ${day} of month ${month}`
}

function getNextFireDate(trigger: ScheduledTrigger): string | null {
  if (trigger.trigger_type === 'one_time') {
    return trigger.fire_at ? new Date(trigger.fire_at).toLocaleString() : null
  }
  if (trigger.trigger_type === 'recurring') {
    return trigger.next_fire_at ? new Date(trigger.next_fire_at).toLocaleString() : null
  }
  return null
}

export function ScheduledTriggersPage() {
  const { currentAccountId } = useAuth()
  const [triggers, setTriggers] = useState<ScheduledTrigger[]>([])
  const [instances, setInstances] = useState<ScheduledTriggerInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    trigger_type: 'one_time' as 'one_time' | 'recurring' | 'countdown',
    action_type: 'webhook',
    action_config: {},
    fire_at: '',
    cron_expression: '',
    delay_seconds: '',
    delay_event: '',
    enabled: true,
  })

  async function load() {
    setLoading(true)
    try {
      const [triggersRes] = await Promise.all([
        apiGet<ScheduledTrigger[]>('scheduled-triggers'),
      ])
      setTriggers(triggersRes || [])
    } catch { setTriggers([]) }
    setLoading(false)
  }

  async function loadInstances(triggerId: string) {
    try {
      const instancesRes = await apiGet<ScheduledTriggerInstance[]>('scheduled-trigger-instances', { trigger_id: triggerId })
      setInstances(instancesRes || [])
    } catch { setInstances([]) }
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId])

  useEffect(() => {
    if (selectedTriggerId) loadInstances(selectedTriggerId)
  }, [selectedTriggerId])

  function resetForm() {
    setForm({
      name: '',
      trigger_type: 'one_time',
      action_type: 'webhook',
      action_config: {},
      fire_at: '',
      cron_expression: '',
      delay_seconds: '',
      delay_event: '',
      enabled: true,
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name || !form.trigger_type || !form.action_type) return
    if (form.trigger_type === 'one_time' && !form.fire_at) {
      alert('Fire date is required for one-time triggers')
      return
    }
    if (form.trigger_type === 'recurring' && !form.cron_expression) {
      alert('Cron expression is required for recurring triggers')
      return
    }
    if (form.trigger_type === 'countdown' && (!form.delay_seconds || !form.delay_event)) {
      alert('Delay seconds and delay event are required for countdown triggers')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, any> = {
        ...form,
        delay_seconds: form.delay_seconds ? parseInt(form.delay_seconds) : undefined,
      }
      if (editingId) {
        await apiPatch('scheduled-triggers', payload, { id: editingId })
      } else {
        await apiPost('scheduled-triggers', payload)
      }
      resetForm()
      load()
    } catch (err: any) {
      alert(err.message || 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this scheduled trigger?')) return
    try {
      await apiDelete('scheduled-triggers', { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      await apiPatch('scheduled-triggers', { enabled }, { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Toggle failed')
    }
  }

  function startEdit(trigger: ScheduledTrigger) {
    setForm({
      name: trigger.name,
      trigger_type: trigger.trigger_type,
      action_type: trigger.action_type,
      action_config: trigger.action_config || {},
      fire_at: trigger.fire_at ? new Date(trigger.fire_at).toISOString().slice(0, 16) : '',
      cron_expression: trigger.cron_expression || '',
      delay_seconds: trigger.delay_seconds?.toString() || '',
      delay_event: trigger.delay_event || '',
      enabled: trigger.enabled,
    })
    setEditingId(trigger.id)
    setShowForm(true)
  }

  const selectedTrigger = triggers.find(t => t.id === selectedTriggerId)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled Triggers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure one-time, recurring, and countdown timers that execute actions.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Trigger
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Scheduled Trigger' : 'New Scheduled Trigger'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Trigger Name *</label>
                <Input
                  placeholder="e.g. Daily health check"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Trigger Type *</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.trigger_type}
                  onChange={e => setForm(p => ({ ...p, trigger_type: e.target.value as any }))}
                >
                  <option value="one_time">One-time</option>
                  <option value="recurring">Recurring</option>
                  <option value="countdown">Countdown</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Action Type *</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.action_type}
                  onChange={e => setForm(p => ({ ...p, action_type: e.target.value }))}
                >
                  {ACTION_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              {form.trigger_type === 'one_time' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fire Date *</label>
                  <Input
                    type="datetime-local"
                    value={form.fire_at}
                    onChange={e => setForm(p => ({ ...p, fire_at: e.target.value }))}
                  />
                </div>
              )}
              {form.trigger_type === 'recurring' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cron Expression *</label>
                  <Input
                    placeholder="0 9 * * 1-5"
                    value={form.cron_expression}
                    onChange={e => setForm(p => ({ ...p, cron_expression: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Examples: 0 9 * * 1-5 (weekdays 9am), 0 */6 * * * (every 6h)
                  </p>
                </div>
              )}
              {form.trigger_type === 'countdown' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Delay Seconds *</label>
                    <Input
                      type="number"
                      placeholder="86400"
                      value={form.delay_seconds}
                      onChange={e => setForm(p => ({ ...p, delay_seconds: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Delay Event *</label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.delay_event}
                      onChange={e => setForm(p => ({ ...p, delay_event: e.target.value }))}
                    >
                      <option value="">Select event...</option>
                      {COMMON_EVENTS.map(event => (
                        <option key={event} value={event}>{event}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
              />
              Enable trigger
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.name || !form.trigger_type || !form.action_type}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : triggers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No scheduled triggers yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create timers to run actions at specific times or in response to events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {triggers.map(trigger => (
              <Card 
                key={trigger.id} 
                className={cn("cursor-pointer transition-colors", selectedTriggerId === trigger.id && "ring-2 ring-primary")}
                onClick={() => setSelectedTriggerId(trigger.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{trigger.name}</h3>
                        <Badge variant={trigger.enabled ? 'default' : 'secondary'}>
                          {trigger.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          {trigger.trigger_type === 'one_time' && <Calendar className="h-3 w-3" />}
                          {trigger.trigger_type === 'recurring' && <Repeat className="h-3 w-3" />}
                          {trigger.trigger_type === 'countdown' && <Timer className="h-3 w-3" />}
                          {trigger.trigger_type}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {trigger.trigger_type === 'one_time' && trigger.fire_at && (
                          <p>Fires: {new Date(trigger.fire_at).toLocaleString()}</p>
                        )}
                        {trigger.trigger_type === 'recurring' && trigger.cron_expression && (
                          <p>Schedule: {formatCron(trigger.cron_expression)}</p>
                        )}
                        {trigger.trigger_type === 'countdown' && (
                          <p>Delay: {trigger.delay_seconds}s after {trigger.delay_event}</p>
                        )}
                        <p>Action: {ACTION_TYPES.find(t => t.value === trigger.action_type)?.label || trigger.action_type}</p>
                        {trigger.fire_count > 0 && (
                          <p>Fired {trigger.fire_count} times{trigger.last_fired_at && `, last: ${new Date(trigger.last_fired_at).toLocaleDateString()}`}</p>
                        )}
                        {trigger.next_fire_at && trigger.trigger_type === 'recurring' && (
                          <p>Next: {new Date(trigger.next_fire_at).toLocaleString()}</p>
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
                          toggleEnabled(trigger.id, !trigger.enabled)
                        }}
                      >
                        {trigger.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(trigger)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(trigger.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="space-y-4">
            {selectedTrigger ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Execution History</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Recent instances for "{selectedTrigger.name}"
                    </p>
                  </CardHeader>
                  <CardContent>
                    {instances.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No execution history yet</p>
                    ) : (
                      <div className="space-y-2">
                        {instances.map(instance => (
                          <div key={instance.id} className="flex items-center justify-between p-2 rounded border">
                            <div className="text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  instance.status === 'fired' ? 'default' :
                                  instance.status === 'failed' ? 'destructive' :
                                  instance.status === 'pending' ? 'secondary' : 'outline'
                                }>
                                  {instance.status}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {new Date(instance.fire_at).toLocaleString()}
                                </span>
                              </div>
                              {instance.fired_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Fired: {new Date(instance.fired_at).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select a trigger to view history</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
