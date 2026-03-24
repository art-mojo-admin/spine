import React, { useState } from 'react'
import { Input } from './input'
import { Textarea } from './textarea'
import { SelectNative } from './select'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Upload, X, Plus, Calendar, Clock, User, Mail, Phone, MapPin, Link as LinkIcon, FileText } from 'lucide-react'

interface FieldSchema {
  type: string
  options?: string[]
  required?: boolean
  permission_overrides?: Record<string, { read?: any; update?: any }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    minLength?: number
    maxLength?: number
  }
  placeholder?: string
  help_text?: string
  default?: any
}

interface ItemTypeSchema {
  record_permissions?: Record<string, { create?: boolean; read?: any; update?: any; delete?: any }>
  fields?: Record<string, FieldSchema>
}

interface AdvancedFieldRendererProps {
  schema: FieldSchema
  data: any
  userRole: string
  editing: boolean
  onChange?: (value: any) => void
  baseRecordAccess?: any
  className?: string
}

export function AdvancedFieldRenderer({ 
  schema, 
  data, 
  userRole, 
  editing, 
  onChange, 
  baseRecordAccess = 'all',
  className = '' 
}: AdvancedFieldRendererProps) {
  // Check field-level permissions
  const access = schema.permission_overrides?.[userRole]?.[editing ? 'update' : 'read'] || baseRecordAccess
  
  // Hide field if no read access
  if (access === 'none' || access === false) {
    return null
  }

  const value = data ?? schema.default
  const disabled = !editing || access === 'read_only'
  const [errors, setErrors] = useState<string[]>([])

  const validateField = (newValue: any): string[] => {
    const newErrors: string[] = []
    
    if (schema.validation) {
      const { min, max, pattern, minLength, maxLength } = schema.validation
      
      if (typeof newValue === 'number') {
        if (min !== undefined && newValue < min) {
          newErrors.push(`Value must be at least ${min}`)
        }
        if (max !== undefined && newValue > max) {
          newErrors.push(`Value must be at most ${max}`)
        }
      }
      
      if (typeof newValue === 'string') {
        if (minLength !== undefined && newValue.length < minLength) {
          newErrors.push(`Must be at least ${minLength} characters`)
        }
        if (maxLength !== undefined && newValue.length > maxLength) {
          newErrors.push(`Must be at most ${maxLength} characters`)
        }
        if (pattern && !new RegExp(pattern).test(newValue)) {
          newErrors.push('Invalid format')
        }
      }
    }
    
    if (schema.required && (!newValue || (Array.isArray(newValue) && newValue.length === 0))) {
      newErrors.push('This field is required')
    }
    
    return newErrors
  }

  const handleChange = (newValue: any) => {
    const newErrors = validateField(newValue)
    setErrors(newErrors)
    onChange?.(newValue)
  }

  const renderField = () => {
    switch (schema.type) {
      case 'text':
        return (
          <div>
            <Input
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              required={schema.required}
              placeholder={schema.placeholder}
              className={className}
            />
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'email':
        return (
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="email"
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                required={schema.required}
                placeholder={schema.placeholder || 'email@example.com'}
                className={`pl-10 ${className}`}
              />
            </div>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'phone':
        return (
          <div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="tel"
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                required={schema.required}
                placeholder={schema.placeholder || '+1 (555) 123-4567'}
                className={`pl-10 ${className}`}
              />
            </div>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'url':
        return (
          <div>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="url"
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                required={schema.required}
                placeholder={schema.placeholder || 'https://example.com'}
                className={`pl-10 ${className}`}
              />
            </div>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'textarea':
        return (
          <div>
            <Textarea
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              required={schema.required}
              placeholder={schema.placeholder}
              className={className}
              rows={schema.validation?.maxLength && schema.validation.maxLength > 200 ? 6 : 3}
            />
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'rich_text':
        if (editing) {
          return (
            <div>
              <Textarea
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                required={schema.required}
                placeholder={schema.placeholder || 'Enter rich text content (HTML supported)'}
                className={className}
                rows={8}
              />
              {schema.help_text && (
                <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
              )}
              <p className="text-xs text-blue-500 mt-1">HTML formatting supported</p>
              {errors.map((error, i) => (
                <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
              ))}
            </div>
          )
        } else {
          return (
            <div 
              className="prose prose-sm max-w-none p-3 border rounded-md bg-gray-50"
              dangerouslySetInnerHTML={{ __html: value || '' }}
            />
          )
        }

      case 'select':
        return (
          <div>
            <SelectNative
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              required={schema.required}
              className={className}
            >
              <option value="">Select...</option>
              {schema.options?.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </SelectNative>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'multiselect':
        if (editing) {
          return (
            <div>
              <div className="space-y-2">
                {schema.options?.map((option) => (
                  <label key={option} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={Array.isArray(value) && value.includes(option)}
                      onChange={(e) => {
                        const currentValues = Array.isArray(value) ? value : []
                        if (e.target.checked) {
                          handleChange([...currentValues, option])
                        } else {
                          handleChange(currentValues.filter(v => v !== option))
                        }
                      }}
                      disabled={disabled}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
              {schema.help_text && (
                <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
              )}
              {errors.map((error, i) => (
                <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
              ))}
            </div>
          )
        } else {
          return (
            <div className="flex flex-wrap gap-1">
              {Array.isArray(value) && value.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          )
        }

      case 'number':
        return (
          <div>
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => handleChange(Number(e.target.value))}
              disabled={disabled}
              required={schema.required}
              placeholder={schema.placeholder}
              min={schema.validation?.min}
              max={schema.validation?.max}
              className={className}
            />
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'boolean':
        return (
          <div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleChange(e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300"
              />
              <span className="text-sm">
                {schema.placeholder || 'Enable this option'}
              </span>
            </div>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'date':
        return (
          <div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                required={schema.required}
                className={`pl-10 ${className}`}
              />
            </div>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'datetime':
        return (
          <div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="datetime-local"
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                required={schema.required}
                className={`pl-10 ${className}`}
              />
            </div>
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )

      case 'array':
        if (editing) {
          return (
            <div>
              <div className="space-y-2">
                {Array.isArray(value) && value.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const newArray = [...value]
                        newArray[index] = e.target.value
                        handleChange(newArray)
                      }}
                      disabled={disabled}
                      placeholder="Enter value"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newArray = value.filter((_: any, i: number) => i !== index)
                        handleChange(newArray)
                      }}
                      disabled={disabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleChange([...(value || []), ''])}
                  disabled={disabled}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              {schema.help_text && (
                <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
              )}
              {errors.map((error, i) => (
                <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
              ))}
            </div>
          )
        } else {
          return (
            <div className="space-y-1">
              {Array.isArray(value) && value.map((item, index) => (
                <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                  {item}
                </div>
              ))}
            </div>
          )
        }

      case 'file':
        if (editing) {
          return (
            <div>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="text-sm text-gray-600">
                  <p>Click to upload or drag and drop</p>
                  <p className="text-xs">PDF, DOC, DOCX, TXT up to 10MB</p>
                </div>
                <Input
                  type="file"
                  className="hidden"
                  disabled={disabled}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // In a real implementation, this would handle file upload
                      handleChange(file.name)
                    }
                  }}
                />
              </div>
              {value && (
                <div className="mt-2 flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{value}</span>
                </div>
              )}
              {schema.help_text && (
                <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
              )}
              {errors.map((error, i) => (
                <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
              ))}
            </div>
          )
        } else {
          return (
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm">{value || 'No file uploaded'}</span>
            </div>
          )
        }

      case 'address':
        if (editing) {
          return (
            <div>
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">Address</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      placeholder="Street Address"
                      value={value?.street || ''}
                      onChange={(e) => handleChange({ ...value, street: e.target.value })}
                      disabled={disabled}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="City"
                        value={value?.city || ''}
                        onChange={(e) => handleChange({ ...value, city: e.target.value })}
                        disabled={disabled}
                      />
                      <Input
                        placeholder="State/Province"
                        value={value?.state || ''}
                        onChange={(e) => handleChange({ ...value, state: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="ZIP/Postal Code"
                        value={value?.postalCode || ''}
                        onChange={(e) => handleChange({ ...value, postalCode: e.target.value })}
                        disabled={disabled}
                      />
                      <Input
                        placeholder="Country"
                        value={value?.country || ''}
                        onChange={(e) => handleChange({ ...value, country: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              </Card>
              {schema.help_text && (
                <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
              )}
              {errors.map((error, i) => (
                <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
              ))}
            </div>
          )
        } else {
          return (
            <div className="text-sm">
              {value ? (
                <div>
                  <div>{value.street}</div>
                  <div>{value.city}, {value.state} {value.postalCode}</div>
                  <div>{value.country}</div>
                </div>
              ) : (
                <span className="text-gray-400">No address provided</span>
              )}
            </div>
          )
        }

      default:
        return (
          <div>
            <Input
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              required={schema.required}
              placeholder={schema.placeholder}
              className={className}
            />
            {schema.help_text && (
              <p className="text-xs text-gray-500 mt-1">{schema.help_text}</p>
            )}
            {errors.map((error, i) => (
              <p key={i} className="text-xs text-red-500 mt-1">{error}</p>
            ))}
          </div>
        )
    }
  }

  return (
    <div className={`advanced-field-renderer ${className}`}>
      {renderField()}
      {!editing && access === 'read_only' && (
        <div className="text-xs text-gray-500 mt-1">Read-only</div>
      )}
    </div>
  )
}

// Helper component for rendering multiple fields from a schema
interface AdvancedFormRendererProps {
  schema: ItemTypeSchema
  data: any
  userRole: string
  editing: boolean
  onChange: (field: string, value: any) => void
  className?: string
  layout?: 'vertical' | 'horizontal' | 'grid'
}

export function AdvancedFormRenderer({ 
  schema, 
  data, 
  userRole, 
  editing, 
  onChange, 
  className = '',
  layout = 'vertical'
}: AdvancedFormRendererProps) {
  const baseRecordAccess = schema.record_permissions?.[userRole]?.[editing ? 'update' : 'read'] || 'all'

  if (!schema.fields) {
    return null
  }

  const fieldEntries = Object.entries(schema.fields)

  const renderLayout = () => {
    switch (layout) {
      case 'horizontal':
        return (
          <div className={`flex flex-wrap gap-6 ${className}`}>
            {fieldEntries.map(([fieldKey, fieldSchema]) => (
              <div key={fieldKey} className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1).replace(/_/g, ' ')}
                  {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <AdvancedFieldRenderer
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

      case 'grid':
        return (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}>
            {fieldEntries.map(([fieldKey, fieldSchema]) => (
              <div key={fieldKey} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1).replace(/_/g, ' ')}
                  {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <AdvancedFieldRenderer
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

      default: // vertical
        return (
          <div className={`space-y-6 ${className}`}>
            {fieldEntries.map(([fieldKey, fieldSchema]) => (
              <div key={fieldKey} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1).replace(/_/g, ' ')}
                  {fieldSchema.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <AdvancedFieldRenderer
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
  }

  return renderLayout()
}
