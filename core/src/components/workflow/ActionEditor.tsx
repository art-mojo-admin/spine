import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConditionEditor } from './ConditionEditor'
import { AIPromptEditor } from './AIPromptEditor'
import { Save, X } from 'lucide-react'
import { useCustomFields } from '@/hooks/useCustomFields'
import { apiGet } from '@/lib/api'

interface CustomActionTypeDef {
  id: string
  slug: string
  name: string
  description: string | null
  config_schema: { fields?: Array<{ key: string; label: string; type: string; placeholder?: string }> }
}

const ACTION_TYPES = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'ai_prompt', label: 'AI Prompt' },
  { value: 'create_entity', label: 'Create Entity' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'create_link', label: 'Create Link' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'schedule_timer', label: 'Schedule Timer' },
]

const NESTED_ACTION_TYPES = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'emit_event', label: 'Emit Event' },
  { value: 'create_entity', label: 'Create Entity' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'create_link', label: 'Create Link' },
  { value: 'send_email', label: 'Send Email' },
]

const DELAY_UNITS = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
]

interface ActionEditorProps {
  action?: any
  onSave: (action: any) => void
  onCancel: () => void
  entityType?: string
}

export function ActionEditor({ action, onSave, onCancel, entityType }: ActionEditorProps) {
  const { fieldPaths } = useCustomFields(entityType)
  const [name, setName] = useState(action?.name || '')
  const [actionType, setActionType] = useState(action?.action_type || 'webhook')
  const [customActionTypes, setCustomActionTypes] = useState<CustomActionTypeDef[]>([])

  useEffect(() => {
    apiGet<CustomActionTypeDef[]>('custom-action-types')
      .then(setCustomActionTypes)
      .catch(() => {})
  }, [])

  const allActionTypes = [
    ...ACTION_TYPES,
    ...customActionTypes.map((c) => ({ value: c.slug, label: `${c.name} (custom)` })),
  ]

  const activeCustomType = customActionTypes.find((c) => c.slug === actionType)
  const [actionConfig, setActionConfig] = useState<any>(action?.action_config || {})
  const [conditions, setConditions] = useState<any[]>(action?.conditions || [])
  const [enabled, setEnabled] = useState(action?.enabled !== false)

  function handleSave() {
    if (!name.trim()) return
    onSave({
      ...action,
      name,
      action_type: actionType,
      action_config: actionConfig,
      conditions,
      enabled,
    })
  }

  function updateConfig(partial: Record<string, any>) {
    setActionConfig((prev: any) => ({ ...prev, ...partial }))
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Action Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Notify Slack" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Action Type</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value)
                setActionConfig({})
              }}
            >
              {allActionTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>

        <div className="border-t pt-3">
          {actionType === 'webhook' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">URL</label>
                <Input
                  value={actionConfig.url || ''}
                  onChange={(e) => updateConfig({ url: e.target.value })}
                  placeholder="https://example.com/webhook"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Method</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={actionConfig.method || 'POST'}
                  onChange={(e) => updateConfig({ method: e.target.value })}
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Body Template (JSON)</label>
                <Textarea
                  rows={3}
                  className="font-mono text-xs"
                  value={actionConfig.body_template ? JSON.stringify(actionConfig.body_template, null, 2) : ''}
                  onChange={(e) => {
                    try { updateConfig({ body_template: JSON.parse(e.target.value) }) } catch {}
                  }}
                  placeholder='{"message": "{{item.title}} moved"}'
                />
              </div>
            </div>
          )}

          {actionType === 'update_field' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Entity Table</label>
                <Input
                  value={actionConfig.entity_table || ''}
                  onChange={(e) => updateConfig({ entity_table: e.target.value })}
                  placeholder="items (default)"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Field</label>
                  <Input
                    value={actionConfig.field || ''}
                    onChange={(e) => updateConfig({ field: e.target.value })}
                    placeholder="e.g. priority or metadata.custom_key"
                    list={entityType ? `action-fields-${entityType}` : undefined}
                  />
                  {entityType && fieldPaths.length > 0 && (
                    <datalist id={`action-fields-${entityType}`}>
                      {fieldPaths.map((fp) => (
                        <option key={fp.path} value={fp.path}>{fp.label}</option>
                      ))}
                    </datalist>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Value</label>
                  <Input
                    value={actionConfig.value ?? ''}
                    onChange={(e) => updateConfig({ value: e.target.value })}
                    placeholder="e.g. high or {{item.metadata.score}}"
                  />
                </div>
              </div>
            </div>
          )}

          {actionType === 'emit_event' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Event Type</label>
                <Input
                  value={actionConfig.event_type || ''}
                  onChange={(e) => updateConfig({ event_type: e.target.value })}
                  placeholder="e.g. deal.escalated"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Entity Type</label>
                <Input
                  value={actionConfig.entity_type || ''}
                  onChange={(e) => updateConfig({ entity_type: e.target.value })}
                  placeholder="e.g. item"
                />
              </div>
            </div>
          )}

          {actionType === 'ai_prompt' && (
            <AIPromptEditor config={actionConfig} onChange={setActionConfig} />
          )}

          {actionType === 'create_entity' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Entity Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={actionConfig.entity_type || 'item'}
                  onChange={(e) => updateConfig({ entity_type: e.target.value })}
                >
                  <option value="item">Item</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Field Mapping (JSON)</label>
                <Textarea
                  rows={4}
                  className="font-mono text-xs"
                  value={actionConfig.field_mapping ? JSON.stringify(actionConfig.field_mapping, null, 2) : ''}
                  onChange={(e) => {
                    try { updateConfig({ field_mapping: JSON.parse(e.target.value) }) } catch {}
                  }}
                  placeholder='{"subject": "Follow-up: {{item.title}}", "priority": "medium"}'
                />
              </div>
            </div>
          )}

          {actionType === 'send_notification' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  rows={2}
                  value={actionConfig.message || ''}
                  onChange={(e) => updateConfig({ message: e.target.value })}
                  placeholder='{{item.title}} has been moved to {{transition.name}}'
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Channel</label>
                <Input
                  value={actionConfig.channel || ''}
                  onChange={(e) => updateConfig({ channel: e.target.value })}
                  placeholder="activity (default)"
                />
              </div>
            </div>
          )}

          {actionType === 'send_email' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Send an email via Resend, SendGrid, or webhook. Configure EMAIL_PROVIDER and EMAIL_API_KEY env vars.</p>
              <div className="space-y-1">
                <label className="text-sm font-medium">To</label>
                <Input
                  value={actionConfig.to || ''}
                  onChange={(e) => updateConfig({ to: e.target.value })}
                  placeholder="{{item.metadata.email}} or user@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={actionConfig.subject || ''}
                  onChange={(e) => updateConfig({ subject: e.target.value })}
                  placeholder="Update on {{item.title}}"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Body (HTML)</label>
                <Textarea
                  rows={4}
                  value={actionConfig.body_html || ''}
                  onChange={(e) => updateConfig({ body_html: e.target.value })}
                  placeholder="<p>Hello, {{item.title}} has been updated.</p>"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Body (Plain Text)</label>
                <Textarea
                  rows={2}
                  value={actionConfig.body_text || ''}
                  onChange={(e) => updateConfig({ body_text: e.target.value })}
                  placeholder="Hello, {{item.title}} has been updated."
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">From (optional)</label>
                <Input
                  value={actionConfig.from || ''}
                  onChange={(e) => updateConfig({ from: e.target.value })}
                  placeholder="Uses EMAIL_FROM env var if blank"
                />
              </div>
            </div>
          )}

          {actionType === 'create_link' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Create a relationship between two entities.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Source Type</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={actionConfig.source_type || 'item'}
                    onChange={(e) => updateConfig({ source_type: e.target.value })}
                  >
                    <option value="person">Person</option>
                    <option value="account">Account</option>
                    <option value="item">Item</option>
                    <option value="document">Document</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Source ID</label>
                  <Input
                    value={actionConfig.source_id || ''}
                    onChange={(e) => updateConfig({ source_id: e.target.value })}
                    placeholder="{{item.id}} or leave blank for trigger entity"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Target Type</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={actionConfig.target_type || 'person'}
                    onChange={(e) => updateConfig({ target_type: e.target.value })}
                  >
                    <option value="person">Person</option>
                    <option value="account">Account</option>
                    <option value="item">Item</option>
                    <option value="document">Document</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Target ID</label>
                  <Input
                    value={actionConfig.target_id || ''}
                    onChange={(e) => updateConfig({ target_id: e.target.value })}
                    placeholder="{{item.owner_person_id}}"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Link Type</label>
                <Input
                  value={actionConfig.link_type || ''}
                  onChange={(e) => updateConfig({ link_type: e.target.value })}
                  placeholder="e.g. participant, contact, related"
                />
              </div>
            </div>
          )}

          {activeCustomType && (
            <div className="space-y-3">
              {activeCustomType.description && (
                <p className="text-xs text-muted-foreground">{activeCustomType.description}</p>
              )}
              {activeCustomType.config_schema?.fields?.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-sm font-medium">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      rows={3}
                      value={actionConfig[field.key] || ''}
                      onChange={(e) => updateConfig({ [field.key]: e.target.value })}
                      placeholder={field.placeholder || ''}
                    />
                  ) : (
                    <Input
                      value={actionConfig[field.key] || ''}
                      onChange={(e) => updateConfig({ [field.key]: e.target.value })}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </div>
              ))}
              {(!activeCustomType.config_schema?.fields || activeCustomType.config_schema.fields.length === 0) && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Action Config (JSON)</label>
                  <Textarea
                    rows={4}
                    className="font-mono text-xs"
                    value={Object.keys(actionConfig).length > 0 ? JSON.stringify(actionConfig, null, 2) : ''}
                    onChange={(e) => {
                      try { setActionConfig(JSON.parse(e.target.value)) } catch {}
                    }}
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}
            </div>
          )}

          {actionType === 'schedule_timer' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Execute a nested action after a delay.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Delay Amount</label>
                  <Input
                    type="number"
                    min={1}
                    value={actionConfig.delay_amount || ''}
                    onChange={(e) => updateConfig({ delay_amount: parseInt(e.target.value, 10) || 0 })}
                    placeholder="15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Delay Unit</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={actionConfig.delay_unit || 'minutes'}
                    onChange={(e) => updateConfig({ delay_unit: e.target.value })}
                  >
                    {DELAY_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Then execute:</p>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Action Type</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={actionConfig.nested_action_type || 'webhook'}
                    onChange={(e) => updateConfig({ nested_action_type: e.target.value, nested_action_config: {} })}
                  >
                    {NESTED_ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {(actionConfig.nested_action_type || 'webhook') === 'webhook' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">URL</label>
                      <Input
                        value={actionConfig.nested_action_config?.url || ''}
                        onChange={(e) => updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), url: e.target.value } })}
                        placeholder="https://hook.make.com/..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Body Template (JSON)</label>
                      <Textarea
                        rows={3}
                        className="font-mono text-xs"
                        value={actionConfig.nested_action_config?.body_template ? JSON.stringify(actionConfig.nested_action_config.body_template, null, 2) : ''}
                        onChange={(e) => {
                          try { updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), body_template: JSON.parse(e.target.value) } }) } catch {}
                        }}
                        placeholder='{"message": "Timer fired for {{item.title}}"}'
                      />
                    </div>
                  </>
                )}

                {actionConfig.nested_action_type === 'update_field' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Field</label>
                      <Input
                        value={actionConfig.nested_action_config?.field || ''}
                        onChange={(e) => updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), field: e.target.value } })}
                        placeholder="e.g. priority or metadata.key"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Value</label>
                      <Input
                        value={actionConfig.nested_action_config?.value ?? ''}
                        onChange={(e) => updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), value: e.target.value } })}
                        placeholder="e.g. high"
                      />
                    </div>
                  </div>
                )}

                {actionConfig.nested_action_type === 'emit_event' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Event Type</label>
                    <Input
                      value={actionConfig.nested_action_config?.event_type || ''}
                      onChange={(e) => updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), event_type: e.target.value } })}
                      placeholder="e.g. deal.reminder"
                    />
                  </div>
                )}

                {actionConfig.nested_action_type === 'send_notification' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      rows={2}
                      value={actionConfig.nested_action_config?.message || ''}
                      onChange={(e) => updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), message: e.target.value } })}
                      placeholder='Reminder: {{item.title}} needs attention'
                    />
                  </div>
                )}

                {actionConfig.nested_action_type === 'create_entity' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Entity Type</label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={actionConfig.nested_action_config?.entity_type || 'item'}
                        onChange={(e) => updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), entity_type: e.target.value } })}
                      >
                        <option value="item">Item</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Field Mapping (JSON)</label>
                      <Textarea
                        rows={3}
                        className="font-mono text-xs"
                        value={actionConfig.nested_action_config?.field_mapping ? JSON.stringify(actionConfig.nested_action_config.field_mapping, null, 2) : ''}
                        onChange={(e) => {
                          try { updateConfig({ nested_action_config: { ...(actionConfig.nested_action_config || {}), field_mapping: JSON.parse(e.target.value) } }) } catch {}
                        }}
                        placeholder='{"subject": "Follow-up: {{item.title}}"}'
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <ConditionEditor conditions={conditions} onChange={setConditions} entityType={entityType} />

        <div className="flex items-center gap-2 border-t pt-3">
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            <Save className="mr-1 h-3 w-3" /> Save Action
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="mr-1 h-3 w-3" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
