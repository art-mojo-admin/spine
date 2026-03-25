import { db } from './db'

export type AccessLevel = 'all' | 'organization_only' | 'own' | 'none' | 'soft'

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'decimal'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'boolean'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'multi-select'
  | 'tags'
  | 'rich-text'
  | 'json'
  | 'workflow_status'

export interface FieldValidation {
  min?: number
  max?: number
  min_length?: number
  max_length?: number
  pattern?: string
  items?: { type: string; max_length?: number }
}

export interface FieldSchema {
  type: FieldType
  required?: boolean
  default?: any
  options?: string[]
  rich_text_format?: 'markdown' | 'html' | 'prosemirror'
  validation?: FieldValidation
  display_label?: string
  description?: string
  group_name?: string
  permissions?: Record<string, { read?: AccessLevel; update?: AccessLevel }>
}

export interface ItemTypeSchema {
  record_permissions: Record<string, { create: boolean; read: AccessLevel; update: AccessLevel; delete: AccessLevel }>
  base_fields: Record<string, FieldSchema>
  fields: Record<string, FieldSchema>
  relationships?: Record<string, { link_slug: string; target_types: string[]; cardinality: string }>
  actions?: Array<{ slug: string; label: string; min_role: string; transitions_to?: string }>
  display?: Record<string, any>
}

export class ItemsDAL {
  static async getItemTypeSchema(itemType: string): Promise<ItemTypeSchema | null> {
    const { data } = await db
      .from('item_type_registry')
      .select('schema')
      .eq('slug', itemType)
      .single()

    return data?.schema || null
  }

  static evaluateRecordAccess(schema: ItemTypeSchema, userRole: string, action: 'create' | 'read' | 'update' | 'delete'): boolean | AccessLevel {
    if (!schema.record_permissions || !schema.record_permissions[userRole]) {
      // Default deny if no permissions defined for role
      return action === 'create' ? false : 'none'
    }

    const rolePerms = schema.record_permissions[userRole]
    if (action === 'create') return rolePerms.create || false
    if (action === 'read') return rolePerms.read || 'none'
    if (action === 'update') return rolePerms.update || 'none'
    if (action === 'delete') return rolePerms.delete || 'none'
    
    return 'none'
  }

  static evaluateFieldAccess(fieldSchema: FieldSchema, userRole: string, recordPermissions: Record<string, { read: AccessLevel; update: AccessLevel }>, action: 'read' | 'update'): AccessLevel {
    // Check for specific field-level override
    if (fieldSchema.permissions && fieldSchema.permissions[userRole]) {
      const override = fieldSchema.permissions[userRole][action]
      if (override !== undefined) return override
    }
    // Inherit from record-level permissions
    return recordPermissions[userRole]?.[action] || 'none'
  }

  static sanitizeItemData(item: any, schema: ItemTypeSchema, userRole: string): any {
    if (!schema.fields || !item.metadata) return item

    const baseReadAccess = this.evaluateRecordAccess(schema, userRole, 'read')
    
    // Early return if no read access
    if (baseReadAccess === 'none' || baseReadAccess === false) {
      return { ...item, metadata: {} }
    }

    const sanitizedMetadata = { ...item.metadata }

    // At this point, TypeScript knows baseReadAccess is not 'none' or false
    // So we don't need to check base fields against 'none' since they inherit record permissions

    // Check custom fields with possible overrides
    for (const [fieldKey, fieldSchema] of Object.entries(schema.fields)) {
      const fieldAccess = this.evaluateFieldAccess(fieldSchema, userRole, schema.record_permissions, 'read')
      if (fieldAccess === 'none') {
        delete sanitizedMetadata[fieldKey]
      }
    }

    return { ...item, metadata: sanitizedMetadata }
  }

  static validateUpdateData(newData: any, existingData: any, schema: ItemTypeSchema, userRole: string): { valid: boolean; error?: string } {
    const { FieldValidator } = require('./field-validator')
    const result = FieldValidator.validateMetadata(newData, schema, userRole)
    
    if (!result.valid) {
      const errorMessages = Object.values(result.errors).join('; ')
      return { valid: false, error: errorMessages }
    }

    return { valid: true }
  }

  /**
   * Package metadata safely using schema validation
   */
  static packageMetadata(body: Record<string, any>, schema: ItemTypeSchema, userRole: string): { valid: boolean; metadata?: Record<string, any>; error?: string } {
    const { FieldValidator } = require('./field-validator')
    return FieldValidator.packageMetadata(body, schema, userRole)
  }
}
