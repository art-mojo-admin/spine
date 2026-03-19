import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, ToggleLeft, ToggleRight, Zap, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AutomationRule {
  id: string
  account_id: string
  workflow_definition_id: string | null
  name: string
  description: string | null
  trigger_event: string
  conditions: any[]
  action_type: string
  action_config: Record<string, any>
  enabled: boolean
  created_at: string
  updated_at: string
}

interface WorkflowDefinition {
  id: string
  name: string
}

const COMMON_EVENTS = [
  'item.created',
  'item.updated',
  'item.stage_changed',
  'item.deleted',
  'thread.created',
  'message.created',
  'account.created',
  'person.created',
  'automation.created',
  'automation.updated',
  'automation.deleted',
]

const ACTION_TYPES = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'create_entity', label: 'Create Entity' },
  { value: 'send_notification', label: 'Send Notification' },
]

export function AutomationsPage() {
  const { currentAccountId } = useAuth()
  const [automations, setAutomations] = useState<AutomationRule[]>([])
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_event: '',
    workflow_definition_id: '',
    action_type: 'webhook',
    action_config: {},
    enabled: true,
  })

  async function load() {
    setLoading(true)
    try {
      const [automationsRes, workflowsRes] = await Promise.all([
        apiGet<AutomationRule[]>('automation-rules'),
        apiGet<WorkflowDefinition[]>('workflow-definitions'),
      ])
      setAutomations(automationsRes || [])
      setWorkflows(workflowsRes || [])
    } catch { setAutomations([]); setWorkflows([]) }
    setLoading(false)
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId])

  function resetForm() {
    setForm({
      name: '',
      description: '',
      trigger_event: '',
      workflow_definition_id: '',
      action_type: 'webhook',
      action_config: {},
      enabled: true,
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.name || !form.trigger_event || !form.action_type) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        workflow_definition_id: form.workflow_definition_id || null,
      }
      if (editingId) {
        await apiPatch('automation-rules', payload, { id: editingId })
      } else {
        await apiPost('automation-rules', payload)
      }
      resetForm()
      load()
    } catch (err: any) {
      alert(err.message || 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this automation rule?')) return
    try {
      await apiDelete('automation-rules', { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      await apiPatch('automation-rules', { enabled }, { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Toggle failed')
    }
  }

  function startEdit(rule: AutomationRule) {
    setForm({
      name: rule.name,
      description: rule.description || '',
      trigger_event: rule.trigger_event,
      workflow_definition_id: rule.workflow_definition_id || '',
      action_type: rule.action_type,
      action_config: rule.action_config || {},
      enabled: rule.enabled,
    })
    setEditingId(rule.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Automation Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define rules that trigger actions when events occur. Rules are evaluated in real-time.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Automation Rule' : 'New Automation Rule'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Rule Name *</label>
                <Input
                  placeholder="e.g. Escalate stale tickets"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Trigger Event *</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.trigger_event}
                  onChange={e => setForm(p => ({ ...p, trigger_event: e.target.value }))}
                >
                  <option value="">Select event...</option>
                  {COMMON_EVENTS.map(event => (
                    <option key={event} value={event}>{event}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Workflow (optional)</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.workflow_definition_id}
                  onChange={e => setForm(p => ({ ...p, workflow_definition_id: e.target.value }))}
                >
                  <option value="">All workflows</option>
                  {workflows.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
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
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Input
                placeholder="What this rule does (optional)"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
              />
              Enable rule
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.name || !form.trigger_event || !form.action_type}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No automation rules yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create rules to automatically respond to events in your workflows.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {automations.map(rule => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{rule.name}</h3>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="font-mono">
                        {rule.trigger_event}
                      </Badge>
                      <Badge variant="outline">
                        {ACTION_TYPES.find(t => t.value === rule.action_type)?.label || rule.action_type}
                      </Badge>
                      {rule.workflow_definition_id && (
                        <Badge variant="outline">
                          {workflows.find(w => w.id === rule.workflow_definition_id)?.name || 'Unknown workflow'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleEnabled(rule.id, !rule.enabled)}
                    >
                      {rule.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(rule)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
