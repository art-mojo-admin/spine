import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, PlugZap, Lock, Package, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomActionType {
  id: string
  account_id: string
  action_key: string
  display_name: string
  description: string | null
  config_schema: Record<string, any>
  ownership: 'tenant' | 'pack'
  pack_id: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

const COMMON_SCHEMAS = [
  {
    name: 'Webhook Action',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', title: 'Webhook URL' },
        method: { type: 'string', enum: ['POST', 'PUT', 'PATCH'], default: 'POST' },
        headers: { type: 'object', title: 'Headers' },
        body_template: { type: 'string', title: 'Body Template' },
      },
      required: ['url'],
    },
  },
  {
    name: 'Email Action',
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', title: 'To Address' },
        subject: { type: 'string', title: 'Subject' },
        template: { type: 'string', title: 'Email Template' },
      },
      required: ['to', 'subject'],
    },
  },
  {
    name: 'Slack Action',
    schema: {
      type: 'object',
      properties: {
        webhook_url: { type: 'string', title: 'Slack Webhook URL' },
        channel: { type: 'string', title: 'Channel' },
        message: { type: 'string', title: 'Message' },
      },
      required: ['webhook_url', 'message'],
    },
  },
]

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function CustomActionTypesPage() {
  const { currentAccountId } = useAuth()
  const [actionTypes, setActionTypes] = useState<CustomActionType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    action_key: '',
    display_name: '',
    description: '',
    config_schema: {},
    enabled: true,
  })

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<CustomActionType[]>('custom-action-types')
      setActionTypes(data || [])
    } catch { setActionTypes([]) }
    setLoading(false)
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId])

  function resetForm() {
    setForm({
      action_key: '',
      display_name: '',
      description: '',
      config_schema: {},
      enabled: true,
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.display_name || !form.action_key) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        action_key: form.action_key || slugify(form.display_name),
      }
      if (editingId) {
        await apiPatch('custom-action-types', payload, { id: editingId })
      } else {
        await apiPost('custom-action-types', payload)
      }
      resetForm()
      load()
    } catch (err: any) {
      alert(err.message || 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this custom action type? This may affect existing automations.')) return
    try {
      await apiDelete('custom-action-types', { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      await apiPatch('custom-action-types', { enabled }, { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Toggle failed')
    }
  }

  function startEdit(actionType: CustomActionType) {
    setForm({
      action_key: actionType.action_key,
      display_name: actionType.display_name,
      description: actionType.description || '',
      config_schema: actionType.config_schema || {},
      enabled: actionType.enabled,
    })
    setEditingId(actionType.id)
    setShowForm(true)
  }

  function applyTemplate(schema: Record<string, any>) {
    setForm(p => ({ ...p, config_schema: schema }))
  }

  const tenantActions = actionTypes.filter(a => a.ownership === 'tenant')
  const packActions = actionTypes.filter(a => a.ownership === 'pack')

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Custom Action Types</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define reusable action types that can be used in automations and scheduled triggers.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Action Type
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Action Type' : 'New Action Type'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name *</label>
                <Input
                  placeholder="e.g. Send Slack Notification"
                  value={form.display_name}
                  onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Action Key</label>
                <Input
                  placeholder={form.display_name ? slugify(form.display_name) : 'auto-generated'}
                  value={form.action_key}
                  onChange={e => setForm(p => ({ ...p, action_key: e.target.value }))}
                  disabled={!!editingId}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Input
                placeholder="What this action does"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Configuration Schema (JSON)</label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {COMMON_SCHEMAS.map(template => (
                    <Button
                      key={template.name}
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate(template.schema)}
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  rows={8}
                  placeholder='{"type": "object", "properties": {...}}'
                  value={JSON.stringify(form.config_schema, null, 2)}
                  onChange={e => {
                    try {
                      const schema = JSON.parse(e.target.value)
                      setForm(p => ({ ...p, config_schema: schema }))
                    } catch {
                      // Invalid JSON, don't update
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Define the configuration schema for this action type. This will be used to validate action configurations.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
              />
              Enable action type
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.display_name || !form.action_key}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {tenantActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Tenant Actions
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Action types defined in this tenant
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tenantActions.map(actionType => (
                    <div key={actionType.id} className="flex items-center justify-between p-3 rounded border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{actionType.display_name}</h3>
                          <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                            {actionType.action_key}
                          </code>
                          {actionType.enabled ? (
                            <Badge variant="default">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        {actionType.description && (
                          <p className="text-sm text-muted-foreground mb-2">{actionType.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Schema: {Object.keys(actionType.config_schema?.properties || {}).length} properties
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleEnabled(actionType.id, !actionType.enabled)}
                        >
                          {actionType.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(actionType)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(actionType.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {packActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Pack Actions
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Action types provided by installed packs (read-only)
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {packActions.map(actionType => (
                    <div key={actionType.id} className="flex items-center justify-between p-3 rounded border opacity-75">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{actionType.display_name}</h3>
                          <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                            {actionType.action_key}
                          </code>
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            pack
                          </Badge>
                          {actionType.enabled ? (
                            <Badge variant="default">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        {actionType.description && (
                          <p className="text-sm text-muted-foreground mb-2">{actionType.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          From pack: {actionType.pack_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleEnabled(actionType.id, !actionType.enabled)}
                        >
                          {actionType.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {tenantActions.length === 0 && packActions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <PlugZap className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No custom action types yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create reusable action types that can be used across automations and scheduled triggers.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
