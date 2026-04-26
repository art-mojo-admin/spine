import React from 'react'
import { FieldDefinition } from '../../types/types'

interface FieldRendererProps {
  field: FieldDefinition
  value: any
  onChange?: (value: any) => void
  readonly?: boolean
  error?: string
  displayType?: string // From view config — controls rendering without polluting field data contract
}

function resolveRenderType(field: FieldDefinition, displayType?: string): string {
  // displayType from view config overrides data_type for rendering decisions
  if (displayType) {
    switch (displayType) {
      case 'textarea':
      case 'rich_text':
        return 'textarea'
      case 'select':
        return 'select'
      case 'multiselect':
        return 'multiselect'
      case 'radio':
        return 'radio'
      case 'checkbox':
      case 'switch':
        return 'checkbox'
      case 'date_picker':
        return 'date'
      case 'datetime_picker':
        return 'datetime'
      case 'color_picker':
        return 'color'
      case 'range_slider':
        return 'range'
      case 'file_upload':
      case 'image_upload':
        return 'file'
    }
  }
  // Fall back to data_type
  switch (field.data_type) {
    case 'textarea':
    case 'rich_text':
      return 'textarea'
    case 'email':
      return 'email'
    case 'phone':
      return 'phone'
    case 'url':
      return 'url'
    case 'number':
    case 'currency':
    case 'range':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'boolean':
    case 'checkbox':
      return 'checkbox'
    case 'select':
      return 'select'
    case 'multiselect':
      return 'multiselect'
    case 'radio':
      return 'radio'
    case 'color':
      return 'color'
    case 'file':
    case 'image':
      return 'file'
    case 'json':
      return 'json'
    default:
      return 'text'
  }
}

export function FieldRenderer({ field, value, onChange, readonly = false, error, displayType }: FieldRendererProps) {
  const renderType = resolveRenderType(field, displayType)

  const renderField = () => {
    switch (renderType) {
      case 'text':
        return readonly ? (
          <div className={`text-slate-900 ${error ? 'border-red-500' : ''}`}>
            {value || <span className="text-slate-400 italic">—</span>}
          </div>
        ) : (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className={`input ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder}
          />
        )

      case 'textarea':
        return readonly ? (
          <div className={`text-slate-900 whitespace-pre-wrap ${error ? 'border-red-500' : ''}`}>
            {value || <span className="text-slate-400 italic">—</span>}
          </div>
        ) : (
          <textarea
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className={`textarea ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder}
            rows={field.rows || 3}
          />
        )

      case 'email':
        return readonly ? (
          <div className={`text-slate-900 ${error ? 'border-red-500' : ''}`}>
            {value ? <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a> : <span className="text-slate-400 italic">—</span>}
          </div>
        ) : (
          <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className={`input ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder}
          />
        )

      case 'phone':
        return readonly ? (
          <div className={`text-slate-900 ${error ? 'border-red-500' : ''}`}>
            {value || <span className="text-slate-400 italic">—</span>}
          </div>
        ) : (
          <input
            type="tel"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className={`input ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder}
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value ? Number(e.target.value) : null)}
            readOnly={readonly}
            className={`input ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder}
            min={field.min ?? field.validation?.min}
            max={field.max ?? field.validation?.max}
            step={field.step ?? field.validation?.step}
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => onChange?.(e.target.value || null)}
            readOnly={readonly}
            className={`input ${error ? 'border-red-500' : ''}`}
          />
        )

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value ? new Date(value).toISOString().slice(0, 16) : ''}
            onChange={(e) => onChange?.(e.target.value || null)}
            readOnly={readonly}
            className={`input ${error ? 'border-red-500' : ''}`}
          />
        )

      case 'select':
        return readonly ? (
          <div className={`text-slate-900 ${error ? 'border-red-500' : ''}`}>
            {(() => {
              if (!value) return <span className="text-slate-400 italic">—</span>
              const option = field.options?.find((opt) => {
                const optVal = typeof opt === 'string' ? opt : opt.value
                return optVal === value
              })
              return typeof option === 'string' ? option : option?.label || value
            })()}
          </div>
        ) : (
          <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className={`select ${error ? 'border-red-500' : ''}`}
          >
            <option value="">Select...</option>
            {field.options?.map((option) => {
              const optVal = typeof option === 'string' ? option : option.value
              const optLabel = typeof option === 'string' ? option : option.label
              return (
                <option key={optVal} value={optVal}>
                  {optLabel}
                </option>
              )
            })}
          </select>
        )

      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label
              return (
                <label key={optionValue} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={Array.isArray(value) && value.includes(optionValue)}
                    onChange={(e) => {
                      const currentValue = Array.isArray(value) ? value : []
                      if (e.target.checked) {
                        onChange?.([...currentValue, optionValue])
                      } else {
                        onChange?.(currentValue.filter((v: string) => v !== optionValue))
                      }
                    }}
                    disabled={readonly}
                    className="mr-2"
                  />
                  <span>{optionLabel}</span>
                </label>
              )
            })}
          </div>
        )

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label
              return (
                <label key={optionValue} className="flex items-center">
                  <input
                    type="radio"
                    name={field.name}
                    value={optionValue}
                    checked={value === optionValue}
                    onChange={(e) => onChange?.(e.target.value)}
                    disabled={readonly}
                    className="mr-2"
                  />
                  <span>{optionLabel}</span>
                </label>
              )
            })}
          </div>
        )

      case 'checkbox':
        return readonly ? (
          <div className={`text-slate-900 ${error ? 'border-red-500' : ''}`}>
            {Boolean(value) ? 'Yes' : 'No'}
          </div>
        ) : (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange?.(e.target.checked)}
              className="mr-2"
            />
            <span>{field.label}</span>
          </label>
        )

      case 'json':
        return readonly ? (
          <pre className="bg-slate-100 p-3 rounded-md text-sm overflow-x-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                onChange?.(JSON.parse(e.target.value))
              } catch {
                // Invalid JSON, don't update
              }
            }}
            className={`textarea font-mono text-sm ${error ? 'border-red-500' : ''}`}
            rows={field.rows || 6}
            placeholder="Enter valid JSON"
          />
        )

      case 'url':
        return readonly ? (
          <div className={`text-slate-900 ${error ? 'border-red-500' : ''}`}>
            {value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">{value}</a> : <span className="text-slate-400 italic">—</span>}
          </div>
        ) : (
          <input
            type="url"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className={`input ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder || 'https://example.com'}
          />
        )

      case 'file':
        return readonly ? (
          value ? (
            <div className="text-sm">
              <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                View File
              </a>
            </div>
          ) : (
            <span className="text-slate-500">No file</span>
          )
        ) : (
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onChange?.(file.name)
            }}
            className={`input ${error ? 'border-red-500' : ''}`}
          />
        )

      case 'color':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={value || '#000000'}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={readonly}
              className="h-10 w-20"
            />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange?.(e.target.value)}
              readOnly={readonly}
              className={`input flex-1 ${error ? 'border-red-500' : ''}`}
              placeholder="#000000"
            />
          </div>
        )

      case 'range':
        return (
          <div className="space-y-2">
            <input
              type="range"
              value={value ?? field.min ?? field.validation?.min ?? 0}
              onChange={(e) => onChange?.(Number(e.target.value))}
              disabled={readonly}
              className="w-full"
              min={field.min ?? field.validation?.min}
              max={field.max ?? field.validation?.max}
              step={field.step ?? field.validation?.step}
            />
            <div className="text-sm text-slate-600">
              Value: {value ?? field.min ?? 0}
            </div>
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readonly}
            className={`input ${error ? 'border-red-500' : ''}`}
            placeholder={field.placeholder}
          />
        )
    }
  }

  return (
    <div className="space-y-1">
      {field.label && (
        <label className="label">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {renderField()}
      
      {field.description && (
        <p className="text-xs text-slate-500">{field.description}</p>
      )}
      
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
