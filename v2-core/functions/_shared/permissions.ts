import { adminDb } from './db'
import { Principal } from './principal'

export interface PermissionResult {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
  fieldPermissions: Record<string, { read: boolean; write: boolean }>
}

export interface RequestContext {
  requestId: string
  
  principal?: Principal
  db?: any
  
  accountId: string | null
  appId: string | null
  query: Record<string, string>
  
}

/**
 * SINGLE PERMISSION ENGINE - The one source of truth for all authorization
 * 
 * All APIs and eventually all UIs should import and use this single instance.
 * No other permission logic should exist in the codebase.
 * 
 * @example
 * import { PermissionEngine } from './_shared/permissions'
 * 
 * // In any API
 * const canRead = await PermissionEngine.canAccessRecord(ctx, record, 'read')
 * const sanitized = await PermissionEngine.sanitizeRecordData(ctx, record, typeSlug)
 */
class _PermissionEngineInternal {
  private static instance: _PermissionEngineInternal

  // Surface classification tables
  private readonly SECOND_SURFACE_TABLES = new Set([
    'apps', 'pipelines', 'triggers', 'ai_agents', 'embeddings', 
    'timers', 'integrations', 'roles', 'types', 'prompt_configs'
  ])

  private readonly THIRD_SURFACE_TABLES = new Set([
    'logs', 'pipeline_executions', 'trigger_executions',
    'link_types', 'links'
  ])

  private constructor() {}

  /**
   * Detect which permission surface a table belongs to
   * 
   * @param tableName - The table name to classify
   * @returns 'first' | 'second' | 'third' - The permission surface
   */
  private detectSurface(tableName: string): 'first' | 'second' | 'third' {
    if (this.SECOND_SURFACE_TABLES.has(tableName)) {
      return 'second'
    }
    if (this.THIRD_SURFACE_TABLES.has(tableName)) {
      return 'third'
    }
    return 'first'
  }

  /**
   * Extract table name from record or context
   * 
   * @param record - The record to extract table name from
   * @param typeSlug - Optional type slug fallback
   * @returns string - The table name
   */
  private extractTableName(record: any, typeSlug?: string): string {
    // Try to get table name from record context
    if (record?.table_name) {
      return record.table_name
    }
    
    // Try to get from type field
    if (record?.type) {
      return record.type
    }
    
    // Try to get from item_type field
    if (record?.item_type) {
      return record.item_type
    }
    
    // Use provided typeSlug
    if (typeSlug) {
      return typeSlug
    }
    
    // Default to unknown (will be treated as first surface)
    return 'unknown'
  }

  /**
   * Get the singleton instance - this is the only way to get the permission engine
   */
  static getInstance(): _PermissionEngineInternal {
    if (!_PermissionEngineInternal.instance) {
      _PermissionEngineInternal.instance = new _PermissionEngineInternal()
    }
    return _PermissionEngineInternal.instance
  }

  /**
   * Resolve first-surface permissions for a user action
   * 
   * @param personId - User's person UUID
   * @param accountId - Account context for the operation
   * @param typeSlug - Target type slug for schema lookup
   * @param action - CRUD action being attempted
   * @param designSchema - Optional pre-loaded design schema (for performance)
   * @returns PermissionResult with record and field permissions
   * 
   * @example
   * const perms = await PermissionEngine.resolveFirstSurfacePermissions(
   *   userPersonId,
   *   clientAccountId,
   *   'support_ticket',
   *   'read'
   * )
   * // Returns: { canRead: true, fieldPermissions: { arr: { read: true } } }
   */
  async resolveFirstSurfacePermissions(
    personId: string,
    accountId: string,
    typeSlug: string,
    _action: 'create' | 'read' | 'update' | 'delete',
    designSchema?: any
  ): Promise<PermissionResult> {
    // Default deny result
    const defaultResult: PermissionResult = {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
      fieldPermissions: {}
    }

    try {
      // 1. Load type design schema if not provided (pre-stamped on record is preferred)
      let schema = designSchema
      if (!schema || !schema.record_permissions) {
        // Attempt type lookup by slug as fallback
        const { data: typeRecord } = await adminDb
          .from('types')
          .select('design_schema')
          .eq('slug', typeSlug)
          .eq('is_active', true)
          .single()

        // No schema = no permissions. RLS controls row access;
        // design_schema controls what the principal can do with the record.
        // A missing or empty schema is an explicit deny — not a free pass.
        if (!typeRecord?.design_schema?.record_permissions) {
          return defaultResult
        }

        schema = typeRecord.design_schema
      }

      // 2. Get user's role via people.role_id FK
      const { data: person } = await adminDb
        .from('people')
        .select('role:role_id(slug)')
        .eq('id', personId)
        .eq('is_active', true)
        .single()

      const roleSlug = (person?.role as any)?.slug || Array.isArray(person?.role) && (person.role as any)[0]?.slug
      if (!roleSlug) {
        return defaultResult
      }

      const userRoles = [roleSlug]

      // 3. Evaluate record permissions for each role
      const recordPermissions = schema.record_permissions || {}
      const fieldDefinitions = schema.fields || {}

      let mergedResult: PermissionResult = {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        fieldPermissions: {}
      }

      // 4. Merge permissions across all roles (union of actions)
      // 'all' is a special wildcard role key: grants access to every authenticated principal
      // that passed RLS, regardless of their named role. Always evaluated.
      const rolesToEvaluate = recordPermissions['all'] ? [...userRoles, 'all'] : userRoles
      for (const role of rolesToEvaluate) {
        const rolePerms = recordPermissions[role]
        if (!rolePerms || !Array.isArray(rolePerms)) continue

        // Merge record permissions using array format: ["create", "read", "update", "delete"]
        mergedResult.canCreate = mergedResult.canCreate || rolePerms.includes('create')
        mergedResult.canRead = mergedResult.canRead || rolePerms.includes('read')
        mergedResult.canUpdate = mergedResult.canUpdate || rolePerms.includes('update')
        mergedResult.canDelete = mergedResult.canDelete || rolePerms.includes('delete')

        // 5. Merge field permissions for this role
        for (const [fieldName, fieldDef] of Object.entries(fieldDefinitions)) {
          const fieldPerms = (fieldDef as any).permissions?.[role]
          if (!fieldPerms || !Array.isArray(fieldPerms)) continue

          if (!mergedResult.fieldPermissions[fieldName]) {
            mergedResult.fieldPermissions[fieldName] = { read: false, write: false }
          }

          // Merge field permissions using array format: ["read", "write"]
          mergedResult.fieldPermissions[fieldName].read = 
            mergedResult.fieldPermissions[fieldName].read || fieldPerms.includes('read')
          mergedResult.fieldPermissions[fieldName].write = 
            mergedResult.fieldPermissions[fieldName].write || fieldPerms.includes('write')
        }
      }

      // 6. Apply record-level access to fields without explicit permissions
      for (const [fieldName, _fieldDef] of Object.entries(fieldDefinitions)) {
        if (!mergedResult.fieldPermissions[fieldName]) {
          mergedResult.fieldPermissions[fieldName] = {
            read: mergedResult.canRead,
            write: mergedResult.canUpdate
          }
        }
      }

      return mergedResult

    } catch (error) {
      console.error('Error resolving permissions:', error)
      return defaultResult
    }
  }

  /**
   * Second surface permissions for config objects
   * Simple admin/system role permissions
   */

  /**
   * Check if user can access a config object (second surface)
   * 
   * @param ctx - Request context
   * @param action - Action being attempted
   * @returns boolean - True if access is allowed
   */
  private canAccessConfigObject(ctx: RequestContext, action: 'create' | 'read' | 'update' | 'delete'): boolean {
    // System admin has full access
    if (this.isSystemAdmin(ctx)) {
      return true
    }
    
    // System role can only read
    if (ctx.principal?.type === 'machine' && action === 'read') {
      return true
    }
    
    // All other access denied
    return false
  }

  /**
   * Sanitize config object data (second surface)
   * 
   * @param ctx - Request context
   * @param record - The record to sanitize
   * @returns Sanitized record
   */
  private sanitizeConfigObject(ctx: RequestContext, record: any): any {
    // System admin sees everything
    if (this.isSystemAdmin(ctx)) {
      return record
    }
    
    // System role sees everything if they have read access
    if (ctx.principal?.type === 'machine') {
      return record
    }
    
    // Others see minimal data
    return {
      id: record.id,
      created_at: record.created_at,
      updated_at: record.updated_at
    }
  }

  /**
   * Validate config object update permissions (second surface)
   * 
   * @param ctx - Request context
   * @param action - Action being attempted
   * @returns { valid: boolean, error?: string }
   */
  private validateConfigObjectPermissions(ctx: RequestContext, action: 'create' | 'read' | 'update' | 'delete'): { valid: boolean; error?: string } {
    if (this.canAccessConfigObject(ctx, action)) {
      return { valid: true }
    }
    
    return { valid: false, error: 'Insufficient permissions for this operation' }
  }

  /**
   * Third surface permissions for system metadata
   * Contextual access based on ownership and system context
   */

  /**
   * Check if user can access system metadata (third surface)
   * 
   * @param ctx - Request context
   * @param record - The record to check access for
   * @param action - Action being attempted
   * @returns boolean - True if access is allowed
   */
  private canAccessSystemMetadata(ctx: RequestContext, record: any, action: 'create' | 'read' | 'update' | 'delete'): boolean {
    // System admin has full access
    if (this.isSystemAdmin(ctx)) {
      return true
    }
    
    // System context has full access
    if (ctx.principal?.type === 'machine') {
      return true
    }
    
    // Users can only read their own data
    if (action === 'read') {
      // Check if user owns this record or is related to it
      if (record.created_by === ctx.principal?.id) {
        return true
      }
      
      // Check account ownership
      if (record.account_id && record.account_id === ctx.accountId) {
        return true
      }
      
      // Check person-specific records
      if (record.person_id && record.person_id === ctx.principal?.id) {
        return true
      }
    }
    
    // Users cannot create/update/delete system metadata
    return false
  }

  /**
   * Sanitize system metadata (third surface)
   * 
   * @param ctx - Request context
   * @param record - The record to sanitize
   * @returns Sanitized record
   */
  private sanitizeSystemMetadata(ctx: RequestContext, record: any): any {
    // System admin and system role see everything
    if (this.isSystemAdmin(ctx) || ctx.principal?.type === 'machine') {
      return record
    }
    
    // Users see only their own data
    if (this.canAccessSystemMetadata(ctx, record, 'read')) {
      return record
    }
    
    // Others see minimal data
    return {
      id: record.id,
      created_at: record.created_at,
      updated_at: record.updated_at
    }
  }

  /**
   * Validate system metadata permissions (third surface)
   * 
   * @param ctx - Request context
   * @param record - The record to validate
   * @param action - Action being attempted
   * @returns { valid: boolean, error?: string }
   */
  private validateSystemMetadataPermissions(ctx: RequestContext, record: any, action: 'create' | 'read' | 'update' | 'delete'): { valid: boolean; error?: string } {
    if (this.canAccessSystemMetadata(ctx, record, action)) {
      return { valid: true }
    }
    
    return { valid: false, error: 'Insufficient permissions for this operation' }
  }

  /**
   * Check if user has system admin role
   * 
   * @param ctx - Request context
   * @returns boolean - True if user is system admin
   */
  isSystemAdmin(ctx: RequestContext): boolean {
    return ctx.principal?.roles?.includes('system_admin') || false
  }

  /**
   * Evaluate if user can access a specific record
   * Routes to appropriate surface based on table classification
   * 
   * @param ctx - Request context
   * @param record - The record to check access for
   * @param action - Action being attempted
   * @returns boolean - True if access is allowed
   */
  async canAccessRecord(
    ctx: RequestContext,
    record: any,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<boolean> {
    // System admin bypasses all checks
    if (this.isSystemAdmin(ctx)) {
      return true
    }

    // Extract table name to determine surface
    const tableName = this.extractTableName(record)
    const surface = this.detectSurface(tableName)

    // Route to appropriate surface logic
    switch (surface) {
      case 'second':
        return this.canAccessConfigObject(ctx, action)
      
      case 'third':
        return this.canAccessSystemMetadata(ctx, record, action)
      
      case 'first':
      default:
        return this.canAccessFirstSurfaceRecord(ctx, record, action)
    }
  }

  /**
   * First surface record access (original logic)
   * 
   * @param ctx - Request context
   * @param record - The record to check access for
   * @param action - Action being attempted
   * @returns boolean - True if access is allowed
   */
  private async canAccessFirstSurfaceRecord(
    ctx: RequestContext,
    record: any,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<boolean> {
    if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
      return false
    }

    // For create operations, check if user can create in this account
    if (action === 'create') {
      const perms = await this.resolveFirstSurfacePermissions(
        ctx.principal.id,
        ctx.accountId,
        record.item_type || record.type || 'unknown',
        'create'
      )
      return perms.canCreate
    }

    // For read/update/delete, check record ownership and permissions
    const perms = await this.resolveFirstSurfacePermissions(
      ctx.principal.id,
      record.account_id || ctx.accountId,
      record.item_type || record.type || 'unknown',
      action
    )

    // Check record-level permission
    const canPerformAction = 
      (action === 'read' && perms.canRead) ||
      (action === 'update' && perms.canUpdate) ||
      (action === 'delete' && perms.canDelete)

    if (!canPerformAction) {
      return false
    }

    // For 'own' access level, check if user owns the record
    const userRoles = ctx.principal?.roles || []
    const hasOwnAccess = userRoles.some(role => {
      const rolePerms = (record.type_schema?.record_permissions || {})[role]
      return rolePerms?.read === 'own' || rolePerms?.update === 'own'
    })

    if (hasOwnAccess && record.created_by !== ctx.principal?.id) {
      return false
    }

    return true
  }

  /**
   * Sanitize record data based on user's field permissions
   * Routes to appropriate surface based on table classification
   * 
   * @param ctx - Request context
   * @param record - The record to sanitize
   * @param typeSlug - Type slug for schema lookup (optional for second/third surfaces)
   * @returns Sanitized record with filtered fields
   */
  async sanitizeRecordData(
    ctx: RequestContext,
    record: any,
    typeSlug?: string
  ): Promise<any> {
    // System admin sees everything
    if (this.isSystemAdmin(ctx)) {
      return record
    }

    // Extract table name to determine surface
    const tableName = this.extractTableName(record, typeSlug)
    const surface = this.detectSurface(tableName)

    // Route to appropriate surface logic
    switch (surface) {
      case 'second':
        return this.sanitizeConfigObject(ctx, record)
      
      case 'third':
        return this.sanitizeSystemMetadata(ctx, record)
      
      case 'first':
      default:
        return this.sanitizeFirstSurfaceRecordData(ctx, record, typeSlug || '')
    }
  }

  /**
   * First surface record sanitization with data formatting
   * 
   * @param ctx - Request context
   * @param record - The record to sanitize
   * @param typeSlug - Type slug for schema lookup
   * @returns Sanitized record with filtered and formatted fields
   */
  private async sanitizeFirstSurfaceRecordData(
    ctx: RequestContext,
    record: any,
    typeSlug: string
  ): Promise<any> {
    if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
      // Return minimal data for unauthenticated users
      return {
        id: record.id,
        created_at: record.created_at,
        updated_at: record.updated_at
      }
    }

    // Use record's design_schema stamped at creation time.
    // No schema or missing record_permissions = deny. RLS controls row access;
    // design_schema controls what the principal can do. No permissions granted = none given.
    const designSchema = record.design_schema
    if (!designSchema || !designSchema.record_permissions) {
      return { id: record.id }
    }

    const perms = await this.resolveFirstSurfacePermissions(
      ctx.principal.id,
      record.account_id || ctx.accountId,
      typeSlug,
      'read',
      designSchema
    )

    if (!perms.canRead) {
      // Return minimal data if no read access
      return {
        id: record.id,
        created_at: record.created_at,
        updated_at: record.updated_at
      }
    }

    // Clone record to avoid mutation
    const sanitized = { ...record }

    // Filter and format data fields based on permissions
    if (sanitized.data && typeof sanitized.data === 'object') {
      const filteredData: any = {}
      
      for (const [fieldName, fieldValue] of Object.entries(sanitized.data)) {
        const fieldPerms = perms.fieldPermissions[fieldName]
        if (fieldPerms && fieldPerms.read) {
          // Apply data formatting using validation schema
          const validationSchema = record.validation_schema || {}
          const fieldValidation = validationSchema.fields?.[fieldName]
          
          if (fieldValidation) {
            // Import formatFieldData function
            const { formatFieldData } = await import('./schema-utils')
            filteredData[fieldName] = formatFieldData(fieldValue, fieldValidation.data_type, {
              currency_code: fieldValidation.currency_code
            })
          } else {
            filteredData[fieldName] = fieldValue
          }
        }
      }
      
      sanitized.data = filteredData
    }

    // Remove metadata field if it exists (should be migrated to data)
    if (sanitized.metadata) {
      delete sanitized.metadata
    }

    return sanitized
  }

  /**
   * Validate update data against user's field permissions
   * Routes to appropriate surface based on table classification
   * 
   * @param ctx - Request context
   * @param updateData - Data being updated
   * @param existingRecord - Existing record data
   * @param typeSlug - Type slug for schema lookup (optional for second/third surfaces)
   * @returns { valid: boolean, error?: string }
   */
  async validateUpdatePermissions(
    ctx: RequestContext,
    updateData: any,
    existingRecord: any,
    typeSlug?: string
  ): Promise<{ valid: boolean; error?: string }> {
    // System admin can update anything — pass data through unsanitized
    if (this.isSystemAdmin(ctx)) {
      return { valid: true, sanitizedData: updateData } as any
    }

    // Extract table name to determine surface
    const tableName = this.extractTableName(existingRecord, typeSlug)
    const surface = this.detectSurface(tableName)

    // Route to appropriate surface logic
    switch (surface) {
      case 'second':
        return this.validateConfigObjectPermissions(ctx, 'update')
      
      case 'third':
        return this.validateSystemMetadataPermissions(ctx, existingRecord, 'update')
      
      case 'first':
      default:
        return this.validateFirstSurfaceUpdatePermissions(ctx, updateData, existingRecord, typeSlug || '')
    }
  }

  /**
   * First surface update validation with data sanitization
   * 
   * @param ctx - Request context
   * @param updateData - Data being updated
   * @param existingRecord - Existing record data
   * @param typeSlug - Type slug for schema lookup
   * @returns { valid: boolean, error?: string, sanitizedData?: any }
   */
  private async validateFirstSurfaceUpdatePermissions(
    ctx: RequestContext,
    updateData: any,
    existingRecord: any,
    typeSlug: string
  ): Promise<{ valid: boolean; error?: string; sanitizedData?: any }> {
    if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
      return { valid: false, error: 'Authentication required' }
    }

    // Use record's design_schema stamped at creation time.
    // No schema or missing record_permissions = deny. RLS controls row access;
    // design_schema controls what the principal can do. No permissions granted = none given.
    const designSchema = existingRecord.design_schema
    if (!designSchema || !designSchema.record_permissions) {
      return { valid: false, error: 'No permissions defined on this record type' }
    }

    const perms = await this.resolveFirstSurfacePermissions(
      ctx.principal.id,
      existingRecord.account_id || ctx.accountId,
      typeSlug,
      'update',
      designSchema
    )

    if (!perms.canUpdate) {
      return { valid: false, error: 'Insufficient permissions to update this record' }
    }

    // Check field-level permissions and sanitize data
    const sanitizedData: any = {}
    const validationSchema = existingRecord.validation_schema || {}

    // Process data fields
    if (updateData.data && typeof updateData.data === 'object') {
      sanitizedData.data = {}
      
      for (const [fieldName, fieldValue] of Object.entries(updateData.data)) {
        const fieldPerms = perms.fieldPermissions[fieldName]
        if (!fieldPerms || !fieldPerms.write) {
          return { valid: false, error: `Insufficient permissions to update field '${fieldName}'` }
        }

        // Apply data sanitization using validation schema
        const fieldValidation = validationSchema.fields?.[fieldName]
        
        if (fieldValidation) {
          // Import sanitizeFieldData function
          const { sanitizeFieldData } = await import('./schema-utils')
          try {
            sanitizedData.data[fieldName] = sanitizeFieldData(
              fieldValue, 
              fieldValidation.data_type, 
              fieldValidation
            )
          } catch (sanitizeError: any) {
            return { valid: false, error: `Field '${fieldName}' validation error: ${sanitizeError.message}` }
          }
        } else {
          sanitizedData.data[fieldName] = fieldValue
        }
      }
    }

    // Process metadata fields (if still present during migration)
    if (updateData.metadata && typeof updateData.metadata === 'object') {
      sanitizedData.metadata = {}
      
      for (const [fieldName, fieldValue] of Object.entries(updateData.metadata)) {
        const fieldPerms = perms.fieldPermissions[fieldName]
        if (!fieldPerms || !fieldPerms.write) {
          return { valid: false, error: `Insufficient permissions to update field '${fieldName}'` }
        }

        // Apply basic sanitization for legacy metadata
        sanitizedData.metadata[fieldName] = fieldValue
      }
    }

    // Copy non-data/metadata fields through
    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'data' && key !== 'metadata') {
        sanitizedData[key] = value
      }
    }

    return { valid: true, sanitizedData }
  }

  // ============================================
  // UNIFIED PRINCIPAL METHODS (New Architecture)
  // ============================================
  
  /**
   * Unified permission check - works for both humans and machines
   * 
   * This is the primary permission check for the Unified Principal Architecture.
   * It handles all actor types: humans (JWT), machines (API keys), cron, triggers.
   * 
   * @param principal - The resolved principal (human or machine)
   * @param record - The record being accessed (must include account_id and type)
   * @param action - The CRUD action being attempted
   * @returns boolean - True if access is allowed
   * 
   * @example
   * const canRead = await PermissionEngine.canPrincipalAccessRecord(
   *   ctx.principal,
   *   { account_id: 'acc_123', type: 'ticket' },
   *   'read'
   * )
   */
  async canPrincipalAccessRecord(
    principal: Principal,
    record: { account_id: string; type?: string; [key: string]: any },
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<boolean> {
    // System admin bypass
    if (principal.type === 'human' && principal.roles?.includes('system_admin')) {
      return true
    }
    
    // Machine scope check
    if (principal.type === 'machine') {
      return this.checkMachineScope(principal, record, action)
    }
    
    // Human: Use existing schema-driven permissions
    if (principal.type === 'human' && principal.accountId) {
      return this.canAccessFirstSurfaceRecord(
        {
          requestId: '',
          principal,
          db: null as any,
          accountId: principal.accountId,
          appId: null,
          query: {}
        } as any,
        record,
        action
      )
    }
    
    return false
  }
  
  /**
   * Check if a machine principal has the required scope for an action
   * 
   * Supports wildcards:
   * - "items:read" matches exactly
   * - "items:*" matches any items action
   * - "*:*" matches everything
   * 
   * @param principal - Machine principal with scopes
   * @param record - The record being accessed
   * @param action - The CRUD action
   * @returns boolean - True if scope is granted
   */
  private checkMachineScope(
    principal: Principal,
    record: any,
    action: string
  ): boolean {
    if (principal.type !== 'machine') return false
    
    const scopes = principal.scopes || []
    const requiredScope = `${record.type || 'resource'}:${action}`
    const [resource] = requiredScope.split(':')
    
    // Exact match
    if (scopes.includes(requiredScope)) return true
    
    // Wildcard resource match (e.g., "items:*" matches "items:read")
    if (scopes.includes(`${resource}:*`)) return true
    
    // Global wildcard
    if (scopes.includes('*:*')) return true
    
    return false
  }
  
  /**
   * Get a summary of principal permissions for audit logging
   * 
   * @param principal - The principal to summarize
   * @returns Object with permission summary
   */
  getPrincipalPermissionSummary(principal: Principal): object {
    if (principal.type === 'human') {
      return {
        type: 'human',
        roles: principal.roles || [],
        is_system_admin: principal.roles?.includes('system_admin') || false
      }
    }
    
    if (principal.type === 'machine') {
      return {
        type: 'machine',
        machine_type: principal.machineType,
        scopes: principal.scopes || [],
        is_internal: principal.isInternal
      }
    }
    
    return { type: 'unknown' }
  }
}

// EXPORT THE SINGLE INSTANCE - This is the only thing anyone should import
export const PermissionEngine: _PermissionEngineInternal = _PermissionEngineInternal.getInstance()

// Legacy exports for backward compatibility - will be removed in future
export const resolveFirstSurfacePermissions = PermissionEngine.resolveFirstSurfacePermissions.bind(PermissionEngine)
export const isSystemAdmin = PermissionEngine.isSystemAdmin.bind(PermissionEngine)
export const canAccessRecord = PermissionEngine.canAccessRecord.bind(PermissionEngine)
export const sanitizeRecordData = PermissionEngine.sanitizeRecordData.bind(PermissionEngine)
export const validateUpdatePermissions = PermissionEngine.validateUpdatePermissions.bind(PermissionEngine)
