import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, SlidersHorizontal, Trash2, Power, Pencil, GripVertical } from 'lucide-react'

const ENTITY_TYPES = [
  { value: 'account', label: 'Account' },
  { value: 'person', label: 'Person' },
  { value: 'item', label: 'Item' },
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

export function CustomFieldDefinitionsPage() {
  const { currentAccountId } = useAuth()
  const [tab, setTab] = useState('item')
  const [fields, setFields] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState<any>(null)
  const [name, setName] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)
  const [defaultValue, setDefaultValue] = useState('')
  const [section, setSection] = useState('')
  const [position, setPosition] = useState(0)

  useEffect(() => { if (currentAccountId) loadFields() }, [currentAccountId, tab])

  async function loadFields() {
    setLoading(true)
    try {
      const data = await apiGet<any[]>('custom-field-definitions', { entity_type: tab })
      setFields(data)
    } catch { setFields([]) }
    setLoading(false)
  }

  function resetForm() {
    setName(''); setFieldKey(''); setFieldType('text'); setOptions('')
    setRequired(false); setDefaultValue(''); setSection(''); setPosition(0)
    setShowForm(false); setEditingField(null)
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
    setDefaultValue(f.default_value || '')
    setSection(f.section || '')
    setPosition(f.position || 0)
    setShowForm(true)
  }

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  async function saveField() {
    if (!name.trim()) return

    const parsedOptions = (fieldType === 'select' || fieldType === 'multi_select')
      ? options.split(',').map(o => o.trim()).filter(Boolean).map(o => ({ value: o, label: o }))
      : []

    const payload: any = {
      name,
      field_type: fieldType,
      options: parsedOptions,
      required,
      default_value: defaultValue || null,
      section: section || null,
      position,
    }

    if (editingField) {
      await apiPatch('custom-field-definitions', payload, { id: editingField.id })
    } else {
      payload.entity_type = tab
      payload.field_key = fieldKey || slugify(name)
      await apiPost('custom-field-definitions', payload)
    }

    resetForm()
    loadFields()
  }

  async function toggleField(f: any) {
    await apiPatch('custom-field-definitions', { enabled: !f.enabled }, { id: f.id })
    loadFields()
  }

  async function deleteField(id: string) {
    await apiDelete(`custom-field-definitions?id=${id}`)
    loadFields()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Fields</h1>
        <p className="mt-1 text-muted-foreground">Define custom data points for each entity type</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENTITY_TYPES.map(et => (
          <Button
            key={et.value}
            variant={tab === et.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setTab(et.value); resetForm() }}
          >
            {et.label}
          </Button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="mr-1 h-3 w-3" /> New Field
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingField ? 'Edit' : 'New'} Custom Field</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SLA Tier" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Field Key</label>
                <Input
                  value={fieldKey || (name ? slugify(name) : '')}
                  onChange={e => setFieldKey(e.target.value)}
                  placeholder="auto-generated"
                  disabled={!!editingField}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">Stored in metadata.{fieldKey || slugify(name) || 'key'}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={fieldType}
                  onChange={e => setFieldType(e.target.value)}
                  disabled={!!editingField}
                >
                  {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Section</label>
                <Input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. Billing Info" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Position</label>
                <Input type="number" value={position} onChange={e => setPosition(Number(e.target.value))} />
              </div>
            </div>

            {(fieldType === 'select' || fieldType === 'multi_select') && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Options (comma-separated)</label>
                <Input value={options} onChange={e => setOptions(e.target.value)} placeholder="Gold, Silver, Bronze" />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Default Value</label>
                <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="h-4 w-4 rounded border" />
                <span className="text-sm">Required</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveField} disabled={!name.trim()}>{editingField ? 'Save' : 'Create'}</Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : fields.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">
            No custom fields for {ENTITY_TYPES.find(e => e.value === tab)?.label}. Click "New Field" to create one.
          </p>
        ) : (
          fields.map((f: any) => (
            <Card key={f.id} className={!f.enabled ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 py-3">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{f.name}</p>
                    <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      metadata.{f.field_key}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px]">{f.field_type}</Badge>
                    {f.required && <Badge variant="destructive" className="text-[10px]">required</Badge>}
                    {f.section && <span className="text-[10px] text-muted-foreground">{f.section}</span>}
                    {(f.field_type === 'select' || f.field_type === 'multi_select') && f.options?.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {f.options.length} option{f.options.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={f.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {f.enabled ? 'Active' : 'Off'}
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(f)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleField(f)}>
                  <Power className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteField(f.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
