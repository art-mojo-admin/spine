import { useState } from 'react'
import { apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, Power, Save, X, Zap } from 'lucide-react'

const EVENT_TYPES = [
  'item.created', 'item.updated', 'item.stage_changed',
  'kb.created', 'kb.updated', 'kb.deleted',
  'account.created', 'account.updated',
  'membership.created', 'membership.updated', 'membership.deleted',
]

const ACTION_TYPES = [
  { value: 'transition_stage', label: 'Transition Stage' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'webhook', label: 'Send Webhook' },
  { value: 'update_field', label: 'Update Field' },
]

interface AutomationsEditorProps {
  automationRules: any[]
  onReload: () => void
}

export function AutomationsEditor({ automationRules, onReload }: AutomationsEditorProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [triggerEvent, setTriggerEvent] = useState(EVENT_TYPES[0])
  const [actionType, setActionType] = useState('emit_event')
  const [actionConfig, setActionConfig] = useState('{}')
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setName(''); setTriggerEvent(EVENT_TYPES[0]); setActionType('emit_event')
    setActionConfig('{}'); setShowForm(false)
  }

  async function createRule() {
    if (!name.trim()) return
    setSaving(true)
    let parsedConfig = {}
    try { parsedConfig = JSON.parse(actionConfig) } catch {}
    try {
      await apiPost('automation-rules', {
        name, trigger_event: triggerEvent,
        action_type: actionType, action_config: parsedConfig,
      })
      resetForm()
      onReload()
    } catch {}
    setSaving(false)
  }

  async function toggleRule(rule: any) {
    await apiPatch('automation-rules', { enabled: !rule.enabled }, { id: rule.id })
    onReload()
  }

  async function deleteRule(id: string) {
    await apiDelete(`automation-rules?id=${id}`)
    onReload()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold">Automations</p>

      {showForm ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Auto-assign urgent" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Trigger Event</label>
            <select
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
            >
              {EVENT_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Action Type</label>
            <select
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Config (JSON)</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border bg-background px-2 py-1.5 text-xs font-mono"
              value={actionConfig}
              onChange={(e) => setActionConfig(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createRule} disabled={saving || !name.trim()}>
              <Save className="mr-1 h-3 w-3" /> Create
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}><X className="mr-1 h-3 w-3" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3 w-3" /> New Rule
        </Button>
      )}

      <div className="space-y-1">
        {automationRules.length === 0 && !showForm && (
          <p className="text-[10px] text-muted-foreground">No automation rules defined.</p>
        )}
        {automationRules.map((rule: any) => (
          <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
            <CardContent className="flex items-center gap-2 py-2 px-3">
              <Zap className={`h-3 w-3 flex-shrink-0 ${rule.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{rule.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {rule.trigger_event} → {rule.action_type}
                </p>
              </div>
              <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-[9px]">
                {rule.enabled ? 'On' : 'Off'}
              </Badge>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => toggleRule(rule)}>
                <Power className="h-2.5 w-2.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => deleteRule(rule.id)}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
