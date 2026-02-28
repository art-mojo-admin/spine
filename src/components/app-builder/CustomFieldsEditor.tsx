import { useState } from 'react'
import { apiPost, apiPatch, apiDelete } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Power, Save, X, SlidersHorizontal } from 'lucide-react'

const ENTITY_TYPES = [
  { value: 'item', label: 'Item' },
  { value: 'account', label: 'Account' },
  { value: 'person', label: 'Person' },
  { value: 'document', label: 'Document' },
  { value: 'thread', label: 'Thread' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Textarea' },
]

interface CustomFieldsEditorProps {
  customFields: any[]
  onReload: () => void
}

export function CustomFieldsEditor({ customFields, onReload }: CustomFieldsEditorProps) {
  const [tab, setTab] = useState('item')
  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState<any>(null)
  const [name, setName] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = customFields.filter((f: any) => f.entity_type === tab)

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  function resetForm() {
    setName(''); setFieldKey(''); setFieldType('text'); setOptions('')
    setRequired(false); setShowForm(false); setEditingField(null)
  }

  function startEdit(f: any) {
    setEditingField(f)
    setName(f.name)
    setFieldKey(f.field_key)
    setFieldType(f.field_type)
    setOptions(
      f.field_type === 'select' || f.field_type === 'multi_select'
        ? (f.options || []).map((o: any) => typeof o === 'string' ? o : o.value).join(', ')
        : ''
    )
    setRequired(f.required)
    setShowForm(true)
  }

  async function saveField() {
    if (!name.trim()) return
    setSaving(true)
    const parsedOptions = (fieldType === 'select' || fieldType === 'multi_select')
      ? options.split(',').map(o => o.trim()).filter(Boolean).map(o => ({ value: o, label: o }))
      : []

    try {
      if (editingField) {
        await apiPatch('custom-field-definitions', {
          name, field_type: fieldType, options: parsedOptions, required,
        }, { id: editingField.id })
      } else {
        await apiPost('custom-field-definitions', {
          entity_type: tab, name, field_key: fieldKey || slugify(name),
          field_type: fieldType, options: parsedOptions, required,
        })
      }
      resetForm()
      onReload()
    } catch {}
    setSaving(false)
  }

  async function toggleField(f: any) {
    await apiPatch('custom-field-definitions', { enabled: !f.enabled }, { id: f.id })
    onReload()
  }

  async function deleteField(id: string) {
    await apiDelete(`custom-field-definitions?id=${id}`)
    onReload()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold">Custom Fields</p>

      <div className="flex flex-wrap gap-1">
        {ENTITY_TYPES.map((et) => (
          <button
            key={et.value}
            onClick={() => { setTab(et.value); resetForm() }}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              tab === et.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {et.label}
          </button>
        ))}
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-md border p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SLA Tier" />
          </div>
          {!editingField && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Key</label>
              <Input
                value={fieldKey || (name ? slugify(name) : '')}
                onChange={(e) => setFieldKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value)}
              disabled={!!editingField}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>
          {(fieldType === 'select' || fieldType === 'multi_select') && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Options (comma-separated)</label>
              <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Gold, Silver, Bronze" />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-3.5 w-3.5 rounded border" />
            Required
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveField} disabled={saving || !name.trim()}>
              <Save className="mr-1 h-3 w-3" /> {editingField ? 'Save' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}><X className="mr-1 h-3 w-3" /> Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3 w-3" /> New Field
        </Button>
      )}

      <div className="space-y-1">
        {filtered.length === 0 && !showForm && (
          <p className="text-[10px] text-muted-foreground">No custom fields for {tab}.</p>
        )}
        {filtered.map((f: any) => (
          <Card key={f.id} className={!f.enabled ? 'opacity-60' : ''}>
            <CardContent className="flex items-center gap-2 py-2 px-3">
              <SlidersHorizontal className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{f.name}</p>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[9px]">{f.field_type}</Badge>
                  <code className="text-[9px] text-muted-foreground">{f.field_key}</code>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => startEdit(f)}>
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => toggleField(f)}>
                <Power className="h-2.5 w-2.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => deleteField(f.id)}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
