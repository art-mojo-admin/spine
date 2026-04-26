import React from 'react'
import { FieldDefinition } from '../../types/types'
import { FieldRenderer } from './FieldRenderer'

interface SchemaFieldsProps {
  fields: FieldDefinition[]
  data: Record<string, any>
  onChange?: (name: string, value: any) => void
  readonly?: boolean
  errors?: Record<string, string>
  /** Render fields in a two-column grid (default: true) */
  twoColumn?: boolean
  /** display_type per field key, sourced from view config — never from field definitions */
  displayTypes?: Record<string, string>
}

/**
 * Renders all fields from a design_schema as a form section.
 * Each field is rendered by FieldRenderer using data_type / display_type.
 * When readonly=true, shows values as read-only display.
 */
export function SchemaFields({
  fields,
  data,
  onChange,
  readonly = false,
  errors = {},
  twoColumn = true,
  displayTypes = {}
}: SchemaFieldsProps) {
  if (!fields || fields.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">No schema fields defined for this type.</p>
    )
  }

  return (
    <div className={twoColumn ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
      {fields.map((field) => (
        <SchemaField
          key={field.name}
          field={field}
          value={field.system ? data[field.name] : (data.data?.[field.name] ?? data[field.name])}
          onChange={onChange}
          readonly={readonly || field.readonly}
          error={errors[field.name]}
          displayType={displayTypes[field.name]}
        />
      ))}
    </div>
  )
}

interface SchemaFieldProps {
  field: FieldDefinition
  value: any
  onChange?: (name: string, value: any) => void
  readonly?: boolean
  error?: string
  displayType?: string
}

function SchemaField({ field, value, onChange, readonly, error, displayType }: SchemaFieldProps) {
  return (
    <FieldRenderer
      field={field}
      value={value}
      onChange={readonly ? undefined : (val) => onChange?.(field.name, val)}
      readonly={readonly}
      error={error}
      displayType={displayType}
    />
  )
}

/**
 * Read-only display of a single schema field value.
 * Used in detail pages when not in edit mode.
 */
export function SchemaFieldDisplay({
  field,
  value
}: {
  field: FieldDefinition
  value: any
}) {
  const displayValue = formatFieldValue(field, value)

  return (
    <div className="flex justify-between items-start py-2">
      <dt className="text-xs text-slate-500 font-medium flex-shrink-0 mr-4">
        {field.label || field.name}:
      </dt>
      <dd className="text-sm text-slate-900 text-right">
        {displayValue}
      </dd>
    </div>
  )
}

function formatFieldValue(field: FieldDefinition, value: any): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic">—</span>
  }

  switch (field.data_type) {
    case 'boolean':
    case 'checkbox':
      return value ? 'Yes' : 'No'

    case 'date':
      try {
        return new Date(value).toLocaleDateString()
      } catch {
        return String(value)
      }

    case 'datetime':
      try {
        return new Date(value).toLocaleString()
      } catch {
        return String(value)
      }

    case 'select': {
      const option = field.options?.find(o => o.value === value)
      return option ? option.label : String(value)
    }

    case 'multiselect': {
      if (!Array.isArray(value)) return String(value)
      return value.map(v => {
        const option = field.options?.find(o => o.value === v)
        return option ? option.label : v
      }).join(', ')
    }

    case 'json':
      return (
        <pre className="text-xs bg-slate-50 rounded p-2 max-w-xs overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      )

    case 'url':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {value}
        </a>
      )

    default:
      return String(value)
  }
}
