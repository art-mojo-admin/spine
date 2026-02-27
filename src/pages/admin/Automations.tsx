import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Zap, Trash2, Power } from 'lucide-react'
import { ConditionEditor } from '@/components/workflow/ConditionEditor'

const EVENT_TYPES = [
  'item.created',
  'item.updated',
  'item.stage_changed',
  'kb.created',
  'kb.updated',
  'kb.deleted',
  'account.created',
  'account.updated',
  'membership.created',
  'membership.updated',
  'membership.deleted',
]

const ACTION_TYPES = [
  { value: 'transition_stage', label: 'Transition Stage' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'webhook', label: 'Send Webhook' },
  { value: 'update_field', label: 'Update Field' },
]

export function AutomationsPage() {
  const { currentAccountId } = useAuth()
  const [rules, setRules] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [triggerEvent, setTriggerEvent] = useState(EVENT_TYPES[0])
  const [actionType, setActionType] = useState('emit_event')
  const [actionConfig, setActionConfig] = useState('{}')
  const [conditions, setConditions] = useState<any[]>([])

  useEffect(() => {
    if (!currentAccountId) return
    loadRules()
  }, [currentAccountId])

  async function loadRules() {
    setLoading(true)
    try {
      setRules(await apiGet<any[]>('automation-rules'))
    } catch {}
    setLoading(false)
  }

  async function createRule() {
    if (!name.trim()) return
    let parsedConfig = {}
    try { parsedConfig = JSON.parse(actionConfig) } catch {}

    await apiPost('automation-rules', {
      name,
      trigger_event: triggerEvent,
      action_type: actionType,
      action_config: parsedConfig,
      conditions,
    })
    setName('')
    setActionConfig('{}')
    setConditions([])
    setShowCreate(false)
    loadRules()
  }

  async function toggleRule(rule: any) {
    await apiPatch('automation-rules', { enabled: !rule.enabled }, { id: rule.id })
    loadRules()
  }

  async function deleteRule(id: string) {
    await apiDelete(`automation-rules?id=${id}`)
    loadRules()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
          <p className="mt-1 text-muted-foreground">Event-driven automation rules</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Rule
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Automation Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Auto-assign urgent items" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Trigger Event</label>
                <select
                  value={triggerEvent}
                  onChange={e => setTriggerEvent(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {EVENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Action Type</label>
                <select
                  value={actionType}
                  onChange={e => setActionType(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>

            <ConditionEditor
              conditions={conditions}
              onChange={setConditions}
              entityType={triggerEvent.startsWith('item') ? 'item' : triggerEvent.startsWith('kb') ? 'document' : triggerEvent.startsWith('account') ? 'account' : triggerEvent.startsWith('membership') ? 'person' : undefined}
            />

            <div className="space-y-1">
              <label className="text-sm font-medium">Action Config (JSON)</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                value={actionConfig}
                onChange={e => setActionConfig(e.target.value)}
                placeholder='{"event_type": "item.escalated"}'
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={createRule}>Create Rule</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automation rules defined</p>
        ) : (
          rules.map((rule: any) => (
            <Card key={rule.id} className={!rule.enabled ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className={`h-5 w-5 ${rule.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-sm text-muted-foreground">
                    On <span className="font-mono text-xs">{rule.trigger_event}</span> → {rule.action_type}
                  </p>
                  {rule.conditions?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                  {rule.enabled ? 'Active' : 'Disabled'}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => toggleRule(rule)}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
