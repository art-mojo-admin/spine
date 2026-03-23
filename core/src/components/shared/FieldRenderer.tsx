import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { SelectNative } from '@/components/ui/select-native'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SlidersHorizontal } from 'lucide-react'

// These should match the types in items-dal.ts
export type AccessLevel = 'all' | 'organization_only' | 'none' | 'soft'

export interface FieldSchema {
  type: string
  options?: string[]
  required?: boolean
  permission_overrides?: Record<string, { read?: AccessLevel; update?: AccessLevel }>
  display_label?: string
  description?: string
  group_name?: string
}

export interface ItemTypeSchema {
  record_permissions?: Record<string, { create?: boolean; read?: AccessLevel; update?: AccessLevel; delete?: AccessLevel }>
  fields?: Record<string, FieldSchema>
}

interface FieldRendererProps {
  schema: ItemTypeSchema
  data: Record<string, any>
  userRole: string
  editing: boolean
  onChange: (data: Record<string, any>) => void
}

export function FieldRenderer({ schema, data, userRole, editing, onChange }: FieldRendererProps) {
  if (!schema.fields) return null

  const baseReadAccess = schema.record_permissions?.[userRole]?.read || 'none'
  const baseUpdateAccess = schema.record_permissions?.[userRole]?.update || 'none'

  // If user cannot read the record at all, don't render fields
  if (baseReadAccess === 'none') return null

  // Group fields by group_name
  const sections = new Map<string, Array<{ key: string; schema: FieldSchema; canEdit: boolean }>>()
  let hasVisibleFields = false

  for (const [key, fieldSchema] of Object.entries(schema.fields)) {
    const readOverride = fieldSchema.permission_overrides?.[userRole]?.read
    const canRead = (readOverride || baseReadAccess) !== 'none'
    
    if (!canRead) continue

    const updateOverride = fieldSchema.permission_overrides?.[userRole]?.update
    const canEdit = editing && (updateOverride || baseUpdateAccess) !== 'none'

    const val = data[key]
    const hasValue = val !== undefined && val !== null && val !== ''

    // Hide empty fields when not editing
    if (!canEdit && !hasValue) continue

    hasVisibleFields = true
    const groupName = fieldSchema.group_name || 'General'
    
    if (!sections.has(groupName)) {
      sections.set(groupName, [])
    }
    sections.get(groupName)!.push({ key, schema: fieldSchema, canEdit })
  }

  if (!hasVisibleFields) return null

  function setValue(key: string, value: any) {
    onChange({ ...data, [key]: value })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="h-4 w-4" />
          Item Fields
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Array.from(sections.entries()).map(([section, fields]) => (
          <div key={section} className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{section}</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(({ key, schema: fSchema, canEdit }) => (
                <FieldInput
                  key={key}
                  fieldKey={key}
                  schema={fSchema}
                  value={data[key]}
                  canEdit={canEdit}
                  onChange={(val) => setValue(key, val)}
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
  fieldKey: string
  schema: FieldSchema
  value: any
  canEdit: boolean
  onChange: (value: any) => void
}

function FieldInput({ fieldKey, schema, value, canEdit, onChange }: FieldInputProps) {
  const displayLabel = schema.display_label || fieldKey
  const displayValue = value ?? ''

  if (!canEdit) {
    let rendered: string
    if (schema.type === 'boolean') {
      rendered = value === true ? 'Yes' : value === false ? 'No' : '—'
    } else {
      rendered = displayValue !== '' ? String(displayValue) : '—'
    }

    return (
      <div>
        <dt className="text-muted-foreground text-sm">{displayLabel}</dt>
        <dd className="mt-0.5 text-sm">{rendered}</dd>
        {schema.description && <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldKey}>{displayLabel} {schema.required && <span className="text-destructive">*</span>}</Label>
      
      {schema.type === 'text' && (
        <Input 
          id={fieldKey}
          value={displayValue} 
          onChange={(e) => onChange(e.target.value)} 
          required={schema.required}
        />
      )}
      
      {schema.type === 'textarea' && (
        <Textarea 
          id={fieldKey}
          value={displayValue} 
          onChange={(e) => onChange(e.target.value)}
          required={schema.required}
        />
      )}
      
      {schema.type === 'number' && (
        <Input 
          id={fieldKey}
          type="number"
          value={displayValue} 
          onChange={(e) => onChange(Number(e.target.value))}
          required={schema.required}
        />
      )}
      
      {schema.type === 'boolean' && (
        <div className="flex items-center h-10">
          <Switch 
            id={fieldKey}
            checked={Boolean(value)} 
            onCheckedChange={onChange} 
          />
        </div>
      )}

      {schema.type === 'select' && schema.options && (
        <SelectNative
          id={fieldKey}
          value={String(displayValue)}
          onChange={(e) => onChange(e.target.value)}
          options={schema.options.map(opt => ({ value: opt, label: opt }))}
        />
      )}

      {schema.description && (
        <p className="text-[0.8rem] text-muted-foreground">{schema.description}</p>
      )}
    </div>
  )
}
