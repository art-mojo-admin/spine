import type { FieldSchema, FieldType, FieldValidation, ItemTypeSchema, AccessLevel } from './items-dal'

export interface FieldValidationResult {
  valid: boolean
  value?: any
  error?: string
}

export interface MetadataValidationResult {
  valid: boolean
  metadata?: Record<string, any>
  errors: Record<string, string>
}

/**
 * Shared field validator used by both backend and frontend
 */
export class FieldValidator {
  /**
   * Validate and coerce a single field value
   */
  static validateField(key: string, value: any, schema: FieldSchema): FieldValidationResult {
    const { type, required, validation, options } = schema

    // Handle undefined/null
    if (value === undefined || value === null) {
      if (required) {
        return { valid: false, error: `${key} is required` }
      }
      return { valid: true, value: schema.default }
    }

    // Empty string handling
    if (typeof value === 'string' && value.trim() === '') {
      if (required) {
        return { valid: false, error: `${key} is required` }
      }
      return { valid: true, value: schema.default }
    }

    // Type-specific validation and coercion
    switch (type) {
      case 'text':
      case 'textarea':
        return this.validateText(value, key, validation)

      case 'number':
        return this.validateNumber(value, key, validation, false)

      case 'decimal':
        return this.validateNumber(value, key, validation, true)

      case 'date':
        return this.validateDate(value, key, validation)

      case 'time':
        return this.validateTime(value, key, validation)

      case 'timestamp':
        return this.validateTimestamp(value, key, validation)

      case 'boolean':
      case 'checkbox':
        return this.validateBoolean(value, key, validation)

      case 'radio':
      case 'select':
        return this.validateSelect(value, key, options, validation)

      case 'multi-select':
        return this.validateMultiSelect(value, key, options, validation)

      case 'tags':
        return this.validateTags(value, key, validation)

      case 'rich-text':
        return this.validateRichText(value, key, schema.rich_text_format, validation)

      case 'json':
        return this.validateJson(value, key, validation)

      case 'workflow_status':
        return { valid: false, error: 'workflow_status is system-managed and cannot be set directly' }

      default:
        return { valid: false, error: `Unknown field type: ${type}` }
    }
  }

  /**
   * Validate entire metadata object against schema and role
   */
  static validateMetadata(
    body: Record<string, any>,
    schema: ItemTypeSchema,
    userRole: string
  ): MetadataValidationResult {
    const errors: Record<string, string> = {}
    const metadata: Record<string, any> = {}

    // Start with schema defaults
    for (const [key, fieldSchema] of Object.entries(schema.fields || {})) {
      const fieldAccess = this.evaluateFieldAccess(fieldSchema, userRole, schema.record_permissions, 'update')
      if (fieldAccess !== 'none') {
        metadata[key] = fieldSchema.default
      }
    }

    // Process incoming data
    for (const [key, value] of Object.entries(body)) {
      // Check if field exists in schema
      const fieldSchema = schema.fields?.[key] || schema.base_fields?.[key]
      if (!fieldSchema) {
        errors[key] = `Field '${key}' is not defined in schema`
        continue
      }

      // Check write permissions
      const fieldAccess = this.evaluateFieldAccess(fieldSchema, userRole, schema.record_permissions, 'update')
      if (fieldAccess === 'none') {
        errors[key] = `Insufficient permissions to update field '${key}'`
        continue
      }

      // Validate field
      const result = this.validateField(key, value, fieldSchema)
      if (!result.valid) {
        errors[key] = result.error || 'Invalid value'
        continue
      }

      metadata[key] = result.value
    }

    // Check required fields
    for (const [key, fieldSchema] of Object.entries(schema.fields || {})) {
      if (fieldSchema.required && (metadata[key] === undefined || metadata[key] === null)) {
        errors[key] = `${key} is required`
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      metadata: Object.keys(errors).length === 0 ? metadata : undefined,
      errors
    }
  }

  /**
   * Package metadata safely with defaults and role filtering
   */
  static packageMetadata(
    body: Record<string, any>,
    schema: ItemTypeSchema,
    userRole: string
  ): { valid: boolean; metadata?: Record<string, any>; error?: string } {
    const result = this.validateMetadata(body, schema, userRole)
    
    if (!result.valid) {
      const errorMessages = Object.values(result.errors).join('; ')
      return { valid: false, error: errorMessages }
    }

    return { valid: true, metadata: result.metadata }
  }

  // Private validation methods

  private static validateText(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    const str = String(value).trim()
    
    if (validation?.min_length && str.length < validation.min_length) {
      return { valid: false, error: `${key} must be at least ${validation.min_length} characters` }
    }
    
    if (validation?.max_length && str.length > validation.max_length) {
      return { valid: false, error: `${key} must be no more than ${validation.max_length} characters` }
    }
    
    if (validation?.pattern && !new RegExp(validation.pattern).test(str)) {
      return { valid: false, error: `${key} format is invalid` }
    }

    return { valid: true, value: str }
  }

  private static validateNumber(value: any, key: string, validation?: FieldValidation, isDecimal: boolean = false): FieldValidationResult {
    const num = isDecimal ? parseFloat(value) : parseInt(value, 10)
    
    if (isNaN(num) || !isFinite(num)) {
      return { valid: false, error: `${key} must be a valid number` }
    }

    if (validation?.min !== undefined && num < validation.min) {
      return { valid: false, error: `${key} must be at least ${validation.min}` }
    }

    if (validation?.max !== undefined && num > validation.max) {
      return { valid: false, error: `${key} must be no more than ${validation.max}` }
    }

    return { valid: true, value: num }
  }

  private static validateDate(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    const str = String(value).trim()
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    
    if (!dateRegex.test(str)) {
      return { valid: false, error: `${key} must be in YYYY-MM-DD format` }
    }

    const date = new Date(str + 'T00:00:00Z')
    if (isNaN(date.getTime())) {
      return { valid: false, error: `${key} is not a valid date` }
    }

    // Check min/max if provided (as timestamps)
    if (validation?.min && date.getTime() < validation.min) {
      return { valid: false, error: `${key} must be after ${new Date(validation.min).toISOString().split('T')[0]}` }
    }

    if (validation?.max && date.getTime() > validation.max) {
      return { valid: false, error: `${key} must be before ${new Date(validation.max).toISOString().split('T')[0]}` }
    }

    return { valid: true, value: str }
  }

  private static validateTime(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    const str = String(value).trim()
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    
    if (!timeRegex.test(str)) {
      return { valid: false, error: `${key} must be in HH:MM format` }
    }

    return { valid: true, value: str }
  }

  private static validateTimestamp(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    const date = new Date(value)
    
    if (isNaN(date.getTime())) {
      return { valid: false, error: `${key} must be a valid timestamp` }
    }

    const isoString = date.toISOString()

    // Check min/max if provided
    if (validation?.min && date.getTime() < validation.min) {
      return { valid: false, error: `${key} must be after ${new Date(validation.min).toISOString()}` }
    }

    if (validation?.max && date.getTime() > validation.max) {
      return { valid: false, error: `${key} must be before ${new Date(validation.max).toISOString()}` }
    }

    return { valid: true, value: isoString }
  }

  private static validateBoolean(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    if (typeof value === 'boolean') {
      return { valid: true, value }
    }

    // Coerce common truthy/falsy values
    if (value === 'true' || value === 1 || value === '1') {
      return { valid: true, value: true }
    }

    if (value === 'false' || value === 0 || value === '0') {
      return { valid: true, value: false }
    }

    return { valid: false, error: `${key} must be true or false` }
  }

  private static validateSelect(value: any, key: string, options?: string[], validation?: FieldValidation): FieldValidationResult {
    const str = String(value).trim()
    
    if (!options || !options.includes(str)) {
      return { valid: false, error: `${key} must be one of: ${options?.join(', ')}` }
    }

    return { valid: true, value: str }
  }

  private static validateMultiSelect(value: any, key: string, options?: string[], validation?: FieldValidation): FieldValidationResult {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${key} must be an array` }
    }

    const cleanArray: string[] = []
    for (const item of value) {
      const str = String(item).trim()
      if (!str) continue

      if (!options || !options.includes(str)) {
        return { valid: false, error: `${key} contains invalid value: ${str}` }
      }
      cleanArray.push(str)
    }

    return { valid: true, value: cleanArray }
  }

  private static validateTags(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    if (!Array.isArray(value)) {
      return { valid: false, error: `${key} must be an array` }
    }

    const cleanArray: string[] = []
    for (const item of value) {
      const str = String(item).trim()
      if (!str) continue

      // Strip HTML and sanitize
      const clean = str.replace(/<[^>]*>/g, '').trim()
      
      if (validation?.items?.max_length && clean.length > validation.items.max_length) {
        return { valid: false, error: `Tag '${clean}' exceeds maximum length` }
      }

      cleanArray.push(clean)
    }

    return { valid: true, value: cleanArray }
  }

  private static validateRichText(value: any, key: string, format?: string, validation?: FieldValidation): FieldValidationResult {
    if (typeof value !== 'object' || !value.format || !value.content) {
      return { valid: false, error: `${key} must be an object with format and content` }
    }

    const { format: contentFormat, content } = value

    if (!['markdown', 'html', 'prosemirror'].includes(contentFormat)) {
      return { valid: false, error: `${key} has invalid format: ${contentFormat}` }
    }

    // Basic sanitization
    let cleanContent = content
    if (contentFormat === 'html') {
      // Strip script tags and dangerous attributes
      cleanContent = content
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '')
    }

    if (validation?.max_length && cleanContent.length > validation.max_length) {
      return { valid: false, error: `${key} exceeds maximum length` }
    }

    return { valid: true, value: { format: contentFormat, content: cleanContent } }
  }

  private static validateJson(value: any, key: string, validation?: FieldValidation): FieldValidationResult {
    if (typeof value === 'object' && value !== null) {
      // Re-serialize to ensure no functions or dangerous content
      try {
        const clean = JSON.parse(JSON.stringify(value))
        return { valid: true, value: clean }
      } catch (e) {
        return { valid: false, error: `${key} contains invalid data` }
      }
    }

    try {
      const parsed = JSON.parse(value)
      const clean = JSON.parse(JSON.stringify(parsed))
      return { valid: true, value: clean }
    } catch (e) {
      return { valid: false, error: `${key} must be valid JSON` }
    }
  }

  private static evaluateFieldAccess(
    fieldSchema: FieldSchema,
    userRole: string,
    recordPermissions: Record<string, { read: AccessLevel; update: AccessLevel }>,
    action: 'read' | 'update'
  ): AccessLevel {
    // Check for specific field-level override
    if (fieldSchema.permissions && fieldSchema.permissions[userRole]) {
      const override = fieldSchema.permissions[userRole][action]
      if (override !== undefined) return override
    }
    // Inherit from record-level permissions
    return recordPermissions[userRole]?.[action] || 'none'
  }
}
