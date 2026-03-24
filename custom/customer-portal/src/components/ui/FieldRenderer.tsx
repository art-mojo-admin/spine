import React from 'react'
import { Input } from './input'
import { Textarea } from './textarea'
import { SelectNative } from './select'

interface FieldSchema {
  type: string
  options?: string[]
  required?: boolean
  permission_overrides?: Record<string, { read?: any; update?: any }>
}

interface ItemTypeSchema {
  record_permissions?: Record<string, { create?: boolean; read?: any; update?: any; delete?: any }>
  fields?: Record<string, FieldSchema>
}

interface FieldRendererProps {
  schema: FieldSchema
  data: any
  userRole: string
  editing: boolean
  onChange?: (value: any) => void
  baseRecordAccess?: any
  className?: string
}

export function FieldRenderer({ 
  schema, 
  data, 
  userRole, 
  editing, 
  onChange, 
  baseRecordAccess = 'all',
  className = '' 
}: FieldRendererProps) {
  // Check field-level permissions
  const access = schema.permission_overrides?.[userRole]?.[editing ? 'update' : 'read'] || baseRecordAccess
  
  // Hide field if no read access
  if (access === 'none' || access === false) {
    return null
  }

  const value = data
  const disabled = !editing || access === 'read_only'

  const renderField = () => {
    switch (schema.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            required={schema.required}
            className={className}
          />
        )

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            required={schema.required}
            className={className}
            rows={3}
          />
        )

      case 'select':
        return (
          <SelectNative
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            required={schema.required}
            className={className}
          >
            <option value="">Select...</option>
            {schema.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectNative>
        )

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange?.(Number(e.target.value))}
            disabled={disabled}
            required={schema.required}
            className={className}
          />
        )

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange?.(e.target.checked)}
              disabled={disabled}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-600">
              {schema.required ? 'Required' : 'Optional'}
            </span>
          </div>
        )

      case 'array':
        if (editing) {
          return (
            <Textarea
              value={Array.isArray(value) ? value.join(', ') : ''}
              onChange={(e) => {
                const arrayValue = e.target.value
                  .split(',')
                  .map(item => item.trim())
                  .filter(item => item.length > 0)
                onChange?.(arrayValue)
              }}
              disabled={disabled}
              placeholder="Enter comma-separated values"
              className={className}
              rows={2}
            />
          )
        } else {
          return (
            <div className="text-sm">
              {Array.isArray(value) && value.length > 0 
                ? value.join(', ')
                : 'None'
              }
            </div>
          )
        }

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            required={schema.required}
            className={className}
          />
        )
    }
  }

  return (
    <div className={`field-renderer ${className}`}>
      {renderField()}
      {!editing && access === 'read_only' && (
        <div className="text-xs text-gray-500 mt-1">Read-only</div>
      )}
    </div>
  )
}

// Helper component for rendering multiple fields from a schema
interface FormRendererProps {
  schema: ItemTypeSchema
  data: any
  userRole: string
  editing: boolean
  onChange: (field: string, value: any) => void
  className?: string
}

export function FormRenderer({ 
  schema, 
  data, 
  userRole, 
  editing, 
  onChange, 
  className = '' 
}: FormRendererProps) {
  const baseRecordAccess = schema.record_permissions?.[userRole]?.[editing ? 'update' : 'read'] || 'all'

  if (!schema.fields) {
    return null
  }

  return (
    <div className={`form-renderer space-y-4 ${className}`}>
      {Object.entries(schema.fields).map(([fieldKey, fieldSchema]) => (
        <div key={fieldKey} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1).replace(/_/g, ' ')}
            {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <FieldRenderer
            schema={fieldSchema}
            data={data[fieldKey]}
            userRole={userRole}
            editing={editing}
            onChange={(value) => onChange(fieldKey, value)}
            baseRecordAccess={baseRecordAccess}
          />
        </div>
      ))}
    </div>
  )
}
