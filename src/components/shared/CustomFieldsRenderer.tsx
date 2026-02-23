import { useCustomFields, type CustomFieldDef } from '@/hooks/useCustomFields'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SlidersHorizontal } from 'lucide-react'

interface CustomFieldsRendererProps {
  entityType: string
  metadata: Record<string, any>
  editing: boolean
  onChange: (metadata: Record<string, any>) => void
}

export function CustomFieldsRenderer({ entityType, metadata, editing, onChange }: CustomFieldsRendererProps) {
  const { fields, loading } = useCustomFields(entityType)

  if (loading || fields.length === 0) return null

  function setValue(key: string, value: any) {
    onChange({ ...metadata, [key]: value })
  }

  // Group by section
  const sections = new Map<string, CustomFieldDef[]>()
  for (const f of fields) {
    const sec = f.section || ''
    if (!sections.has(sec)) sections.set(sec, [])
    sections.get(sec)!.push(f)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="h-4 w-4" />
          Custom Fields
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Array.from(sections.entries()).map(([section, sectionFields]) => (
          <div key={section || '__default'} className="mb-4 last:mb-0">
            {section && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {sectionFields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={metadata[field.field_key]}
                  editing={editing}
                  onChange={(val) => setValue(field.field_key, val)}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

interface FieldInputProps {
  field: CustomFieldDef
  value: any
  editing: boolean
  onChange: (value: any) => void
}

function FieldInput({ field, value, editing, onChange }: FieldInputProps) {
  const displayValue = value ?? field.default_value ?? ''

  if (!editing) {
    let rendered: string
    if (field.field_type === 'boolean') {
      rendered = value === true ? 'Yes' : value === false ? 'No' : '—'
    } else if (field.field_type === 'multi_select' && Array.isArray(value)) {
      rendered = value.join(', ') || '—'
    } else {
      rendered = displayValue !== '' && displayValue !== null && displayValue !== undefined
        ? String(displayValue)
        : '—'
    }

    return (
      <div>
        <dt className="text-muted-foreground text-sm">{field.name}</dt>
        <dd className="mt-0.5 text-sm">{rendered}</dd>
      </div>
    )
  }

  const label = (
    <label className="text-muted-foreground text-sm block mb-1">
      {field.name}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )

  switch (field.field_type) {
    case 'textarea':
      return (
        <div className="sm:col-span-2">
          {label}
          <Textarea
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
        </div>
      )

    case 'number':
      return (
        <div>
          {label}
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      )

    case 'date':
      return (
        <div>
          {label}
          <Input
            type="date"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border"
          />
          <span className="text-sm">{field.name}</span>
          {field.required && <span className="text-destructive text-xs">*</span>}
        </div>
      )

    case 'select':
      return (
        <div>
          {label}
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— Select —</option>
            {(field.options || []).map((opt: any) => {
              const val = typeof opt === 'string' ? opt : opt.value
              const lbl = typeof opt === 'string' ? opt : opt.label
              return <option key={val} value={val}>{lbl}</option>
            })}
          </select>
        </div>
      )

    case 'multi_select': {
      const selected: string[] = Array.isArray(value) ? value : []
      return (
        <div>
          {label}
          <div className="flex flex-wrap gap-2">
            {(field.options || []).map((opt: any) => {
              const val = typeof opt === 'string' ? opt : opt.value
              const lbl = typeof opt === 'string' ? opt : opt.label
              const isSelected = selected.includes(val)
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter((v) => v !== val)
                      : [...selected, val]
                    onChange(next)
                  }}
                  className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {lbl}
                </button>
              )
            })}
          </div>
        </div>
      )
    }

    case 'url':
      return (
        <div>
          {label}
          <Input
            type="url"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
          />
        </div>
      )

    case 'email':
      return (
        <div>
          {label}
          <Input
            type="email"
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
      )

    default:
      return (
        <div>
          {label}
          <Input
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )
  }
}
