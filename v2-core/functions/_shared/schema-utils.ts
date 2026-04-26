import { FieldDefinition } from '../../src/types/types'

/**
 * Schema Generation and Data Transformation Utilities
 * 
 * This module provides functions for:
 * - Generating validation schemas from design schemas
 * - Sanitizing input data based on data_type
 * - Formatting output data for user-friendly display
 */

export interface ValidationSchema {
  fields: Record<string, {
    data_type: string
    required?: boolean
    [key: string]: any // Type-specific validation properties
  }>
}

/**
 * Generate a validation schema from a design schema
 * Extracts only structural validation rules (no permissions, no display_type, no views, no functionality)
 * Every field's explicit constraints are extracted exactly as declared.
 */
export function generateValidationSchema(designSchema: any): ValidationSchema {
  const validationSchema: ValidationSchema = {
    fields: {}
  }

  if (!designSchema.fields) {
    return validationSchema
  }

  for (const [fieldName, fieldDef] of Object.entries(designSchema.fields)) {
    const field = fieldDef as FieldDefinition
    
    // Extract only structural validation properties exactly as declared
    const validationField: any = {
      data_type: field.data_type,
      required: field.required
    }

    // Add explicit validation constraints exactly as declared
    if (field.validation) {
      Object.assign(validationField, field.validation)
    }

    // Add type-specific constraint properties (moved out of validation for clarity)
    if (field.options) {
      validationField.options = field.options
    }

    // Add reference properties if they exist
    if (field.data_type === 'reference' && field.validation) {
      if (field.validation.reference_kind) validationField.reference_kind = field.validation.reference_kind
      if (field.validation.reference_type) validationField.reference_type = field.validation.reference_type
    }

    validationSchema.fields[fieldName] = validationField
  }

  return validationSchema
}

/**
 * Sanitize field data based on data_type and validation rules
 */
export function sanitizeFieldData(
  data: any, 
  data_type: string, 
  validation?: any
): any {
  if (data === null || data === undefined) {
    return data
  }

  switch (data_type) {
    case 'text':
      return sanitizeText(data, validation)
    case 'textarea':
      return sanitizeTextarea(data, validation)
    case 'rich_text':
      return sanitizeRichText(data, validation)
    case 'email':
      return sanitizeEmail(data, validation)
    case 'phone':
      return sanitizePhone(data, validation)
    case 'url':
      return sanitizeUrl(data, validation)
    case 'number':
      return sanitizeNumber(data, validation)
    case 'currency':
      return sanitizeCurrency(data, validation)
    case 'range':
      return sanitizeRange(data, validation)
    case 'date':
      return sanitizeDate(data, validation)
    case 'datetime':
      return sanitizeDatetime(data, validation)
    case 'boolean':
      return sanitizeBoolean(data, validation)
    case 'checkbox':
      return sanitizeCheckbox(data, validation)
    case 'select':
      return sanitizeSelect(data, validation)
    case 'multiselect':
      return sanitizeMultiselect(data, validation)
    case 'radio':
      return sanitizeRadio(data, validation)
    case 'color':
      return sanitizeColor(data, validation)
    case 'file':
      return sanitizeFile(data, validation)
    case 'image':
      return sanitizeImage(data, validation)
    case 'json':
      return sanitizeJson(data, validation)
    case 'reference':
      return sanitizeReference(data, validation)
    case 'address':
      return sanitizeAddress(data, validation)
    default:
      return data
  }
}

/**
 * Format field data for user-friendly display
 */
export function formatFieldData(
  data: any, 
  data_type: string, 
  context?: any
): any {
  if (data === null || data === undefined) {
    return data
  }

  switch (data_type) {
    case 'json':
      return formatJson(data)
    case 'date':
      return formatDate(data)
    case 'datetime':
      return formatDatetime(data)
    case 'currency':
      return formatCurrency(data, context)
    case 'phone':
      return formatPhone(data)
    case 'url':
      return formatUrl(data)
    case 'reference':
      return formatReference(data, context)
    case 'address':
      return formatAddress(data)
    case 'multiselect':
      return formatMultiselect(data)
    case 'boolean':
      return formatBoolean(data, context)
    default:
      return data
  }
}

/**
 * Transform record data based on validation schema and operation
 */
export function transformRecordData(
  data: Record<string, any>,
  validationSchema: ValidationSchema,
  operation: 'sanitize' | 'format',
  context?: any
): Record<string, any> {
  const transformed: Record<string, any> = {}

  for (const [fieldName, fieldValue] of Object.entries(data)) {
    const fieldValidation = validationSchema.fields[fieldName]
    
    if (!fieldValidation) {
      // No validation schema for this field, pass through as-is
      transformed[fieldName] = fieldValue
      continue
    }

    if (operation === 'sanitize') {
      transformed[fieldName] = sanitizeFieldData(
        fieldValue, 
        fieldValidation.data_type, 
        fieldValidation
      )
    } else if (operation === 'format') {
      transformed[fieldName] = formatFieldData(
        fieldValue, 
        fieldValidation.data_type, 
        context
      )
    }
  }

  return transformed
}

// Data Type Specific Sanitization Functions

function sanitizeText(data: any, validation?: any): string {
  let text = String(data).trim()
  
  // Remove control characters except newlines and tabs
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Escape HTML entities
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  
  // Apply length constraints
  if (validation?.minLength && text.length < validation.minLength) {
    throw new Error(`Text must be at least ${validation.minLength} characters`)
  }
  if (validation?.maxLength && text.length > validation.maxLength) {
    text = text.substring(0, validation.maxLength)
  }
  
  // Apply pattern validation
  if (validation?.pattern) {
    const regex = new RegExp(validation.pattern)
    if (!regex.test(text)) {
      throw new Error(`Text does not match required pattern`)
    }
  }
  
  return text
}

function sanitizeTextarea(data: any, validation?: any): string {
  let text = String(data).trim()
  
  // Remove control characters except newlines and tabs
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Escape HTML entities but preserve line breaks
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
  
  // Apply length constraints
  if (validation?.minLength && text.length < validation.minLength) {
    throw new Error(`Text must be at least ${validation.minLength} characters`)
  }
  if (validation?.maxLength && text.length > validation.maxLength) {
    text = text.substring(0, validation.maxLength)
  }
  
  return text
}

function sanitizeRichText(data: any, validation?: any): string {
  let html = String(data).trim()
  
  // Basic HTML sanitization - allow only safe tags
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g
  
  html = html.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      return match
    }
    return ''
  })
  
  // Remove script tags and on* attributes
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  html = html.replace(/on\w+\s*=/gi, '')
  
  // Apply length constraints
  if (validation?.minLength && html.length < validation.minLength) {
    throw new Error(`Content must be at least ${validation.minLength} characters`)
  }
  if (validation?.maxLength && html.length > validation.maxLength) {
    html = html.substring(0, validation.maxLength)
  }
  
  return html
}

function sanitizeEmail(data: any, validation?: any): string {
  let email = String(data).toLowerCase().trim()
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format')
  }
  
  return email
}

function sanitizePhone(data: any, validation?: any): string {
  let phone = String(data).trim()
  
  // Remove all non-digit characters except +
  phone = phone.replace(/[^\d+]/g, '')
  
  // Apply pattern validation if specified
  if (validation?.pattern) {
    const regex = new RegExp(validation.pattern)
    if (!regex.test(phone)) {
      throw new Error('Phone number does not match required format')
    }
  }
  
  return phone
}

function sanitizeUrl(data: any, validation?: any): string {
  let url = String(data).trim()
  
  // Basic URL validation
  try {
    const urlObj = new URL(url)
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed')
    }
    return urlObj.toString()
  } catch {
    throw new Error('Invalid URL format')
  }
}

function sanitizeNumber(data: any, validation?: any): number {
  let num = Number(data)
  
  if (isNaN(num)) {
    throw new Error('Invalid number')
  }
  
  // Apply min/max constraints
  if (validation?.min !== undefined && num < validation.min) {
    throw new Error(`Number must be at least ${validation.min}`)
  }
  if (validation?.max !== undefined && num > validation.max) {
    throw new Error(`Number must be at most ${validation.max}`)
  }
  
  // Apply step constraint
  if (validation?.step) {
    const remainder = num % validation.step
    if (remainder !== 0) {
      num = num - remainder // Round down to nearest step
    }
  }
  
  return num
}

function sanitizeCurrency(data: any, validation?: any): number {
  let num = Number(data)
  
  if (isNaN(num)) {
    throw new Error('Invalid currency amount')
  }
  
  // Round to 2 decimal places for currency
  num = Math.round(num * 100) / 100
  
  // Apply min/max constraints
  if (validation?.min !== undefined && num < validation.min) {
    throw new Error(`Amount must be at least ${validation.min}`)
  }
  if (validation?.max !== undefined && num > validation.max) {
    throw new Error(`Amount must be at most ${validation.max}`)
  }
  
  return num
}

function sanitizeRange(data: any, validation?: any): number {
  return sanitizeNumber(data, validation)
}

function sanitizeDate(data: any, validation?: any): string {
  let dateStr = String(data).trim()
  
  // Try to parse as ISO date
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format')
  }
  
  // Return as ISO date string
  const isoDate = date.toISOString().split('T')[0]
  
  // Apply min/max constraints
  if (validation?.min) {
    const minDate = new Date(validation.min)
    if (date < minDate) {
      throw new Error(`Date must be on or after ${validation.min}`)
    }
  }
  if (validation?.max) {
    const maxDate = new Date(validation.max)
    if (date > maxDate) {
      throw new Error(`Date must be on or before ${validation.max}`)
    }
  }
  
  return isoDate
}

function sanitizeDatetime(data: any, validation?: any): string {
  let dateStr = String(data).trim()
  
  // Try to parse as ISO datetime
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error('Invalid datetime format')
  }
  
  // Return as ISO datetime string
  const isoDatetime = date.toISOString()
  
  // Apply min/max constraints
  if (validation?.min) {
    const minDate = new Date(validation.min)
    if (date < minDate) {
      throw new Error(`Datetime must be on or after ${validation.min}`)
    }
  }
  if (validation?.max) {
    const maxDate = new Date(validation.max)
    if (date > maxDate) {
      throw new Error(`Datetime must be on or before ${validation.max}`)
    }
  }
  
  return isoDatetime
}

function sanitizeBoolean(data: any, validation?: any): boolean {
  if (typeof data === 'boolean') {
    return data
  }
  
  const str = String(data).toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(str)) {
    return true
  } else if (['false', '0', 'no', 'off'].includes(str)) {
    return false
  }
  
  throw new Error('Invalid boolean value')
}

function sanitizeCheckbox(data: any, validation?: any): boolean {
  return sanitizeBoolean(data, validation)
}

function sanitizeSelect(data: any, validation?: any): string {
  let value = String(data).trim()
  
  // Validate against allowed options
  if (validation?.options) {
    // Options are now just an array of strings
    const allowedValues = Array.isArray(validation.options) ? validation.options : []
    if (!allowedValues.includes(value)) {
      throw new Error('Invalid option selected')
    }
  }
  
  return value
}

function sanitizeMultiselect(data: any, validation?: any): string[] {
  let values: string[]
  
  if (Array.isArray(data)) {
    values = data.map(item => String(item).trim())
  } else if (typeof data === 'string') {
    values = data.split(',').map(item => item.trim())
  } else {
    throw new Error('Multiselect must be an array or comma-separated string')
  }
  
  // Remove duplicates
  values = [...new Set(values)]
  
  // Validate against allowed options
  if (validation?.options) {
    // Options are now just an array of strings
    const allowedValues = Array.isArray(validation.options) ? validation.options : []
    for (const value of values) {
      if (!allowedValues.includes(value)) {
        throw new Error(`Invalid option: ${value}`)
      }
    }
  }
  
  // Apply max selection count
  if (validation?.max && values.length > validation.max) {
    values = values.slice(0, validation.max)
  }
  
  return values
}

function sanitizeRadio(data: any, validation?: any): string {
  return sanitizeSelect(data, validation)
}

function sanitizeColor(data: any, validation?: any): string {
  let color = String(data).trim()
  
  // Validate hex color format
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  if (!hexRegex.test(color)) {
    throw new Error('Invalid color format. Use #RRGGBB or #RGB format')
  }
  
  // Normalize to 6-digit hex
  if (color.length === 4) {
    color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
  }
  
  return color.toUpperCase()
}

function sanitizeFile(data: any, validation?: any): any {
  // Basic file validation - would need more sophisticated handling in practice
  if (typeof data !== 'object' || !data.name) {
    throw new Error('Invalid file data')
  }
  
  // Validate file size
  if (validation?.maxSize && data.size > validation.maxSize) {
    throw new Error(`File size exceeds maximum of ${validation.maxSize} bytes`)
  }
  
  // Validate file type
  if (validation?.allowedTypes && !validation.allowedTypes.includes(data.type)) {
    throw new Error(`File type ${data.type} is not allowed`)
  }
  
  // Sanitize filename
  data.name = data.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  
  return data
}

function sanitizeImage(data: any, validation?: any): any {
  const file = sanitizeFile(data, validation)
  
  // Additional image-specific validation
  if (validation?.maxWidth || validation?.maxHeight) {
    // Would need to actually load and check image dimensions
    // For now, just pass through
  }
  
  return file
}

function sanitizeJson(data: any, validation?: any): any {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      throw new Error('Invalid JSON format')
    }
  }
  
  // Basic security check - prevent code injection
  const jsonStr = JSON.stringify(data)
  if (jsonStr.includes('function') || jsonStr.includes('eval') || jsonStr.includes('script')) {
    throw new Error('JSON contains potentially dangerous content')
  }
  
  return data
}

function sanitizeReference(data: any, validation?: any): string {
  let ref = String(data).trim()
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(ref)) {
    throw new Error('Invalid reference format')
  }
  
  // Would need to check existence in referenced table
  // For now, just validate format
  
  return ref
}

function sanitizeAddress(data: any, validation?: any): any {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Address must be an object')
  }
  
  // Sanitize each address component
  const sanitized: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// Data Type Specific Formatting Functions

function formatJson(data: any): string {
  return JSON.stringify(data, null, 2)
}

function formatDate(data: string): string {
  const date = new Date(data)
  if (isNaN(date.getTime())) {
    return data
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatDatetime(data: string): string {
  const date = new Date(data)
  if (isNaN(date.getTime())) {
    return data
  }
  
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatCurrency(data: number, context?: any): string {
  const currency = context?.currency_code || 'USD'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(data)
}

function formatPhone(data: string): string {
  // Basic US phone formatting
  const phone = data.replace(/\D/g, '')
  if (phone.length === 10) {
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
  } else if (phone.length === 11 && phone[0] === '1') {
    return `+${phone[0]} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`
  }
  
  return data
}

function formatUrl(data: string): string {
  return data
}

function formatReference(data: string, context?: any): string {
  // Would need to look up the referenced entity
  // For now, return the UUID
  return data
}

function formatAddress(data: any): string {
  if (typeof data !== 'object' || data === null) {
    return String(data)
  }
  
  const parts = [
    data.street,
    data.city,
    data.state,
    data.postal_code,
    data.country
  ].filter(Boolean)
  
  return parts.join(', ')
}

function formatMultiselect(data: string[]): string {
  if (!Array.isArray(data)) {
    return String(data)
  }
  
  return data.join(', ')
}

function formatBoolean(data: boolean, context?: any): string {
  if (context?.field === 'is_active') {
    return data ? 'Active' : 'Inactive'
  }
  
  return data ? 'Yes' : 'No'
}
