import { db } from './db'

export type AccessLevel = 'all' | 'organization_only' | 'none' | 'soft'

export interface FieldSchema {
  type: string
  options?: string[]
  required?: boolean
  permission_overrides?: Record<string, { read?: AccessLevel; update?: AccessLevel }>
}

export interface ItemTypeSchema {
  record_permissions?: Record<string, { create?: boolean; read?: AccessLevel; update?: AccessLevel; delete?: AccessLevel }>
  fields?: Record<string, FieldSchema>
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

  static evaluateRecordAccess(schema: ItemTypeSchema, userRole: string, action: 'create' | 'read' | 'update' | 'delete'): AccessLevel | boolean {
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

  static evaluateFieldAccess(fieldSchema: FieldSchema, userRole: string, baseRecordAccess: AccessLevel, action: 'read' | 'update'): AccessLevel {
    // Check for specific override
    if (fieldSchema.permission_overrides && fieldSchema.permission_overrides[userRole]) {
      const override = fieldSchema.permission_overrides[userRole][action]
      if (override) return override
    }
    // Fallback to record-level access
    return baseRecordAccess
  }

  static sanitizeItemData(item: any, schema: ItemTypeSchema, userRole: string): any {
    if (!schema.fields || !item.data) return item

    const baseReadAccess = this.evaluateRecordAccess(schema, userRole, 'read') as AccessLevel
    if (baseReadAccess === 'none') {
      return { ...item, data: {} } // Strip all data if they shouldn't even read the record
    }

    const sanitizedData = { ...item.data }

    for (const [fieldKey, fieldSchema] of Object.entries(schema.fields)) {
      const fieldAccess = this.evaluateFieldAccess(fieldSchema, userRole, baseReadAccess, 'read')
      if (fieldAccess === 'none') {
        delete sanitizedData[fieldKey]
      }
    }

    return { ...item, data: sanitizedData }
  }

  static validateUpdateData(newData: any, existingData: any, schema: ItemTypeSchema, userRole: string): { valid: boolean; error?: string } {
    if (!schema.fields) return { valid: true }

    const baseUpdateAccess = this.evaluateRecordAccess(schema, userRole, 'update') as AccessLevel
    
    for (const key of Object.keys(newData)) {
      if (schema.fields[key]) {
        const fieldAccess = this.evaluateFieldAccess(schema.fields[key], userRole, baseUpdateAccess, 'update')
        
        if (fieldAccess === 'none' && JSON.stringify(newData[key]) !== JSON.stringify(existingData?.[key])) {
          return { valid: false, error: `Role '${userRole}' is not permitted to update field '${key}'` }
        }
      }
    }

    return { valid: true }
  }
}
