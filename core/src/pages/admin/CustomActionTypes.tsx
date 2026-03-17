import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Pencil, ExternalLink } from 'lucide-react'

interface CustomActionType {
  id: string
  slug: string
  name: string
  description: string | null
  handler_url: string
  config_schema: Record<string, any>
  created_at: string
  updated_at: string
}

export function CustomActionTypesPage() {
  const [actions, setActions] = useState<CustomActionType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ slug: '', name: '', description: '', handler_url: '', config_schema: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiGet<CustomActionType[]>('custom-action-types')
      setActions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    let schema: Record<string, any> = {}
    if (form.config_schema.trim()) {
      try {
        schema = JSON.parse(form.config_schema)
      } catch {
        alert('Invalid JSON in config schema')
        return
      }
    }

    try {
      if (editingId) {
        await apiPatch('custom-action-types', {
          name: form.name,
          description: form.description || null,
          handler_url: form.handler_url,
          config_schema: schema,
        }, { id: editingId })
      } else {
        await apiPost('custom-action-types', {
          slug: form.slug,
          name: form.name,
          description: form.description || null,
          handler_url: form.handler_url,
          config_schema: schema,
        })
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ slug: '', name: '', description: '', handler_url: '', config_schema: '' })
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this custom action type?')) return
    try {
      await apiDelete('custom-action-types', { id })
      await load()
    } catch (err: any) {
      alert(err.message)
    }
  }

  function startEdit(action: CustomActionType) {
    setEditingId(action.id)
    setForm({
      slug: action.slug,
      name: action.name,
      description: action.description || '',
      handler_url: action.handler_url,
      config_schema: Object.keys(action.config_schema).length > 0 ? JSON.stringify(action.config_schema, null, 2) : '',
    })
    setShowForm(true)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Action Types</h1>
          <p className="text-sm text-muted-foreground">
            Register external action handlers for use in automations and workflows
          </p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditingId(null); setForm({ slug: '', name: '', description: '', handler_url: '', config_schema: '' }) }}>
          <Plus className="mr-2 h-4 w-4" /> Add Action Type
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold">{editingId ? 'Edit Action Type' : 'New Action Type'}</h3>
          {!editingId && (
            <Input
              placeholder="Slug (e.g. send_sms)"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          )}
          <Input
            placeholder="Display name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            placeholder="Handler URL (e.g. https://hooks.example.com/sms)"
            value={form.handler_url}
            onChange={(e) => setForm({ ...form, handler_url: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Config Schema (JSON, optional)</label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[100px]"
              placeholder='{"fields": [{"key": "phone_number", "label": "Phone Number", "type": "string"}]}'
              value={form.config_schema}
              onChange={(e) => setForm({ ...form, config_schema: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>Save</Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : actions.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No custom action types registered. Create one to extend automations and workflows.
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{action.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{action.slug}</code>
                </div>
                {action.description && <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>}
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <span className="truncate">{action.handler_url}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="ghost" size="icon" onClick={() => startEdit(action)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(action.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
