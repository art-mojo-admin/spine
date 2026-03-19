import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Pencil, Lock, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum', label: 'Enum' },
  { value: 'ref', label: 'Reference' },
  { value: 'json', label: 'JSON' },
]

interface FieldDefinition {
  id: string
  item_type: string
  field_key: string
  field_type: string
  field_label: string
  is_required: boolean
  default_value: any
  validation_rules: Record<string, any>
  display_config: Record<string, any>
  ownership: string
  pack_id: string | null
  created_at: string
}

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function FieldDefinitionsPage() {
  const { currentAccountId } = useAuth()
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [itemTypeFilter, setItemTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    item_type: '',
    field_key: '',
    field_type: 'text',
    field_label: '',
    is_required: false,
  })

  async function load() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (itemTypeFilter) params.item_type = itemTypeFilter
      const data = await apiGet<FieldDefinition[]>('field-definitions', params)
      setFields(data || [])
    } catch { setFields([]) }
    setLoading(false)
  }

  useEffect(() => {
    if (currentAccountId) load()
  }, [currentAccountId, itemTypeFilter])

  function resetForm() {
    setForm({ item_type: '', field_key: '', field_type: 'text', field_label: '', is_required: false })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.item_type || !form.field_label) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        field_key: form.field_key || slugify(form.field_label),
      }
      if (editingId) {
        await apiPatch('field-definitions', { field_label: payload.field_label, is_required: payload.is_required }, { id: editingId })
      } else {
        await apiPost('field-definitions', payload)
      }
      resetForm()
      load()
    } catch (err: any) {
      alert(err.message || 'Save failed')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this field definition? This may break existing items.')) return
    try {
      await apiDelete('field-definitions', { id })
      load()
    } catch (err: any) {
      alert(err.message || 'Delete failed')
    }
  }

  function startEdit(f: FieldDefinition) {
    setForm({
      item_type: f.item_type,
      field_key: f.field_key,
      field_type: f.field_type,
      field_label: f.field_label,
      is_required: f.is_required,
    })
    setEditingId(f.id)
    setShowForm(true)
  }

  const grouped = fields.reduce<Record<string, FieldDefinition[]>>((acc, f) => {
    if (!acc[f.item_type]) acc[f.item_type] = []
    acc[f.item_type].push(f)
    return acc
  }, {})

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Field Definitions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define fields for item types. Validated on every item mutation.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by item type..."
          value={itemTypeFilter}
          onChange={e => setItemTypeFilter(e.target.value)}
          className="max-w-xs"
        />
        {itemTypeFilter && (
          <Button variant="ghost" size="sm" onClick={() => setItemTypeFilter('')}>Clear</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit Field' : 'New Field Definition'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Item Type *</label>
                <Input
                  placeholder="e.g. ticket, task, contact"
                  value={form.item_type}
                  onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Field Label *</label>
                <Input
                  placeholder="e.g. Priority"
                  value={form.field_label}
                  onChange={e => setForm(p => ({ ...p, field_label: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Field Key</label>
                <Input
                  placeholder={form.field_label ? slugify(form.field_label) : 'auto-generated'}
                  value={form.field_key}
                  onChange={e => setForm(p => ({ ...p, field_key: e.target.value }))}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Field Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.field_type}
                  onChange={e => setForm(p => ({ ...p, field_type: e.target.value }))}
                  disabled={!!editingId}
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={e => setForm(p => ({ ...p, is_required: e.target.checked }))}
              />
              Required field
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !form.item_type || !form.field_label}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <SlidersHorizontal className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No field definitions yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Field definitions are validated against custom_fields on every item mutation.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([itemType, typeFields]) => (
          <Card key={itemType}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono">{itemType}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {typeFields.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{f.field_label}</span>
                          <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                            {f.field_key}
                          </code>
                          {f.is_required && (
                            <Badge variant="destructive" className="text-xs">required</Badge>
                          )}
                          {f.ownership === 'pack' && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Lock className="h-2.5 w-2.5" />pack
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          type: <span className={cn(
                            'font-mono',
                            f.field_type === 'text' ? 'text-blue-500' :
                            f.field_type === 'number' ? 'text-green-500' :
                            f.field_type === 'date' ? 'text-purple-500' :
                            f.field_type === 'boolean' ? 'text-orange-500' :
                            'text-muted-foreground'
                          )}>{f.field_type}</span>
                        </p>
                      </div>
                    </div>
                    {f.ownership !== 'pack' && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(f.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
