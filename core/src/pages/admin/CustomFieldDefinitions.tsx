import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useActiveApp } from '@/hooks/useActiveApp'
import { withActiveAppScope, requireActiveAppScope, MissingActiveAppError } from '@/lib/activeApp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActiveAppContextBar } from '@/components/admin/ActiveAppContext'
import { cn } from '@/lib/utils'
import { Plus, SlidersHorizontal, Trash2, Power, Pencil, GripVertical, Lock } from 'lucide-react'

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
  const { activeApp, isHydrated } = useActiveApp()
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
  const [workflowTypes, setWorkflowTypes] = useState<string>('')
  const [contextError, setContextError] = useState<string | null>(null)

  useEffect(() => { if (currentAccountId) loadFields() }, [currentAccountId, tab])
  useEffect(() => { setContextError(null) }, [activeApp?.packId])

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
    setRequired(false); setDefaultValue(''); setSection(''); setPosition(0); setWorkflowTypes('')
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
    setWorkflowTypes((f.workflow_types || []).join(', '))
    setShowForm(true)
  }

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  async function saveField() {
    if (!name.trim()) return

    setContextError(null)
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
      workflow_types: workflowTypes ? workflowTypes.split(',').map(s => s.trim()).filter(Boolean) : null,
    }

    try {
      if (editingField) {
        requireActiveAppScope()
        await apiPatch('custom-field-definitions', payload, { id: editingField.id })
      } else {
        payload.entity_type = tab
        payload.field_key = fieldKey || slugify(name)
        await apiPost('custom-field-definitions', withActiveAppScope(payload, { required: true }))
      }

      resetForm()
      loadFields()
    } catch (err) {
      if (err instanceof MissingActiveAppError) {
        setContextError(err.message)
      } else {
        throw err
      }
    }
  }

  function isFieldGuarded(field: any) {
    if (!field.pack_id) return false
    if (!activeApp?.packId) return false
    return field.pack_id !== activeApp.packId
  }

  const guardMessage = 'Locked to another pack. Set it active before editing.'

  function ensureFieldEditable(field: any) {
    setContextError(null)
    if (isFieldGuarded(field)) {
      setContextError(guardMessage)
      return false
    }
    return true
  }

  async function toggleField(f: any) {
    if (!ensureFieldEditable(f)) return
    try {
      requireActiveAppScope()
      await apiPatch('custom-field-definitions', { enabled: !f.enabled }, { id: f.id })
      loadFields()
    } catch (err) {
      if (err instanceof MissingActiveAppError) {
        setContextError(err.message)
      } else {
        throw err
      }
    }
  }

  async function deleteField(id: string) {
    const field = fields.find((f) => f.id === id)
    if (field && !ensureFieldEditable(field)) return
    try {
      requireActiveAppScope()
      await apiDelete(`custom-field-definitions?id=${id}`)
      loadFields()
    } catch (err) {
      if (err instanceof MissingActiveAppError) {
        setContextError(err.message)
      } else {
        throw err
      }
    }
  }

  const contextReady = !isHydrated || !!activeApp

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Fields</h1>
        <p className="mt-1 text-muted-foreground">Define custom data points for each entity type</p>
      </div>

      <ActiveAppContextBar />

      {contextError && (
        <Card>
          <CardContent className="py-2 text-sm text-destructive">{contextError}</CardContent>
        </Card>
      )}

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
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }} disabled={!contextReady} title={!contextReady ? 'Select an app to add fields' : undefined}>
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
                <Input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
              </div>
            </div>

            {tab === 'item' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Workflow Types <span className="text-xs font-normal text-muted-foreground">(comma-separated, optional)</span></label>
                <Input value={workflowTypes} onChange={(e) => setWorkflowTypes(e.target.value)} placeholder="e.g. article, course, deal" />
              </div>
            )}

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
              <Button onClick={saveField} disabled={!name.trim() || !contextReady} title={!contextReady ? 'Select an app to save fields' : undefined}>
                {editingField ? 'Save' : 'Create'}
              </Button>
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
          fields.map((f: any) => {
            const guarded = isFieldGuarded(f)
            const disabled = !contextReady || guarded

            return (
              <Card
                key={f.id}
                className={cn(
                  !f.enabled && 'opacity-60',
                  guarded && 'border-dashed border-muted/80 opacity-60 cursor-not-allowed'
                )}
                title={guarded ? guardMessage : undefined}
              >
                <CardContent className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{f.name}</p>
                        <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          metadata.{f.field_key}
                        </code>
                        {f.pack_id && (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {f.pack_id.slice(0, 8)}
                          </Badge>
                        )}
                        {guarded && (
                          <Badge variant="destructive" className="text-[10px]">
                            Locked
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">{f.field_type}</Badge>
                        {f.required && <Badge variant="destructive" className="text-[10px]">required</Badge>}
                        <span className="text-[10px] text-muted-foreground">Pos: {f.position}</span>
                        {f.workflow_types?.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">Types: {f.workflow_types.join(', ')}</Badge>
                        )}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        if (!ensureFieldEditable(f)) return
                        startEdit(f)
                      }}
                      disabled={disabled}
                      title={
                        !contextReady
                          ? 'Select an app to edit fields'
                          : guarded
                            ? guardMessage
                            : undefined
                      }
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleField(f)}
                      disabled={disabled}
                      title={
                        !contextReady
                          ? 'Select an app to toggle fields'
                          : guarded
                            ? guardMessage
                            : undefined
                      }
                    >
                      <Power className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => deleteField(f.id)}
                      disabled={disabled}
                      title={
                        !contextReady
                          ? 'Select an app to delete fields'
                          : guarded
                            ? guardMessage
                            : 'Delete field'
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {guarded && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-600">
                      <Lock className="h-3 w-3" /> Locked to another pack
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
