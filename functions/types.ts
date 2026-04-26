import { createHandler } from './_shared/middleware'
import { adminDb, joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'
import { generateValidationSchema } from './_shared/schema-utils'

// Type assertion to ensure we're using the instance
const permissions = PermissionEngine as any

// List types - RLS enforced via ctx.db
export const list = createHandler(async (ctx, body) => {
  const { kind, app_id, ownership, limit = 50, offset = 0 } = ctx.query || {}

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('types')
    .select(`*, ${joins.app}`)
    .eq('is_active', true)
    .order('kind')
    .order('name')

  if (kind) {
    query = query.eq('kind', kind)
  }

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else if (app_id === 'null') {
    query = query.is('app_id', null)
  }

  if (ownership) {
    query = query.eq('ownership', ownership)
  }

  const { data, error: err } = await query
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (err) throw err

  // For authenticated users, always include design_schema for schema-driven UI
  // System admin sees everything, others get sanitized data with design_schema preserved
  const sanitized = []
  for (const type of data || []) {
    if (ctx.principal) {
      // Authenticated user - get sanitized data but preserve design_schema
      const sanitizedType = await sanitizeRecordData(ctx, type, 'type')
      // Ensure design_schema is preserved for schema-driven UI
      if (type.design_schema && !sanitizedType.design_schema) {
        sanitizedType.design_schema = type.design_schema
      }
      sanitized.push(sanitizedType)
    } else {
      // Unauthenticated user - return minimal data
      sanitized.push({
        id: type.id,
        slug: type.slug,
        name: type.name,
        kind: type.kind
      })
    }
  }

  return sanitized
})

// Get single type - RLS enforced
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Type ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .select(`*, ${joins.app}`)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'type')
})

// Get type by slug - RLS enforced
export const getBySlug = createHandler(async (ctx, body) => {
  const { slug } = ctx.query || {}
  
  if (!slug) {
    throw new Error('Type slug is required')
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .select(`*, ${joins.app}`)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'type')
})

// Get type design schema - RLS enforced via RPC
export const getSchema = createHandler(async (ctx, body) => {
  const { kind, slug, app_id } = ctx.query || {}

  if (!kind || !slug) {
    throw new Error('kind and slug are required')
  }

  const { data, error: err } = await ctx.db
    .rpc('get_type_schema', {
      kind,
      slug,
      app_id: app_id || null
    })

  if (err) throw err

  return { design_schema: data }
})

// Create type - RLS enforced, master tenant check preserved
export const create = createHandler(async (ctx, body) => {
  const { app_id, kind, slug, name, description, icon, color, design_schema: bodySchema = {}, ownership } = body

  if (!kind || !slug || !name) {
    throw new Error('kind, slug, and name are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Config mutations (types) are only allowed in master tenant by system admins
  if (!permissions.isSystemAdmin(ctx)) {
    throw new Error('Only system administrators can create type configurations')
  }

  // Verify the current account is a master tenant (parent_id IS NULL)
  // Use adminDb for this check since we're verifying account structure
  const { data: accountData } = await adminDb
    .from('accounts')
    .select('parent_id')
    .eq('id', ctx.accountId!)
    .single()

  if (!accountData || accountData.parent_id !== null) {
    throw new Error('Type configurations can only be created in master tenant accounts')
  }

  // Check if slug is unique within app/kind
  let query = adminDb
    .from('types')
    .select('id')
    .eq('kind', kind)
    .eq('slug', slug)

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else {
    query = query.is('app_id', null)
  }

  const { data: existing } = await query.single()

  if (existing) {
    throw new Error('Type slug already exists for this kind and app')
  }

  // Basic schema validation
  if (bodySchema && typeof bodySchema === 'object') {
    if (bodySchema.fields && (typeof bodySchema.fields !== 'object' || bodySchema.fields === null)) {
      throw new Error('Schema fields must be an object')
    }
  }

  // For non-system ownership, we need an app_id to satisfy the constraint
  let finalAppId = app_id
  let finalOwnership = ownership
  
  if (!app_id && ownership !== 'system') {
    // Get the first available app for tenant/custom types
    const { data: apps } = await adminDb
      .from('apps')
      .select('id')
      .limit(1)
      .single()
    
    if (apps?.id) {
      finalAppId = apps.id
      finalOwnership = 'app' // Use 'app' ownership when associated with an app
    } else {
      throw new Error('Cannot create type without app_id for non-system ownership')
    }
  }

  // Generate validation schema from design schema
  const validationSchema = generateValidationSchema(bodySchema || {})

  const { data, error: err } = await adminDb
    .from('types')
    .insert({
      app_id: finalAppId,
      kind,
      slug,
      name,
      description,
      icon,
      color,
      design_schema: bodySchema || {},
      validation_schema: validationSchema,
      ownership: finalOwnership || 'system',
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.created', { type: 'type', id: data.id }, { after: data })

  return data
})

// Update type - RLS enforced, master tenant check preserved
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Type ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible types
  const { data: current } = await adminDb
    .from('types')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Type not found')
  }

  // Config mutations (types) are only allowed in master tenant by system admins
  if (!permissions.isSystemAdmin(ctx)) {
    throw new Error('Only system administrators can update type configurations')
  }

  // System types can only be updated by system admins (already checked above)
  // App types require app ownership verification
  if (current.ownership === 'app' && current.app_id) {
    // Verify user has access to this app
    const { data: appAccess } = await adminDb
      .from('apps')
      .select('id')
      .eq('id', current.app_id)
      .eq('is_active', true)
      .single()
    
    if (!appAccess) {
      throw new Error('App not found or inactive')
    }
  }

  // Verify the current account is a master tenant (parent_id IS NULL)
  // Use adminDb for this check since we're verifying account structure
  const { data: accountData } = await adminDb
    .from('accounts')
    .select('parent_id')
    .eq('id', ctx.accountId!)
    .single()

  if (!accountData || accountData.parent_id !== null) {
    throw new Error('Type configurations can only be updated in master tenant accounts')
  }

  // Validate field-level permissions
  const fieldValidation = await permissions.validateUpdatePermissions(
    ctx,
    updates,
    current,
    'type'
  )
  
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error)
  }

  // Prevent ownership changes for system types to avoid constraint violations
  if (current.ownership === 'system' && updates.ownership && updates.ownership !== 'system') {
    // Remove ownership from updates to preserve system ownership
    delete updates.ownership
  }

  // Handle app_id null conversion for system types
  if (updates.app_id === '') {
    updates.app_id = null
  }

  // Validate design_schema if being updated
  if (updates.design_schema) {
    if (typeof updates.design_schema !== 'object' || updates.design_schema === null) {
      throw new Error('Design schema must be an object')
    }
    if (updates.design_schema.fields && (typeof updates.design_schema.fields !== 'object' || updates.design_schema.fields === null)) {
      throw new Error('Design schema fields must be an object')
    }
    
    // Auto-generate validation_schema when design_schema changes
    updates.validation_schema = generateValidationSchema(updates.design_schema)
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.updated', { type: 'type', id }, { before: current, after: data })

  return data
})

// Soft delete type - RLS enforced, master tenant check preserved
export const remove = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id

  if (!id) {
    throw new Error('Type ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible types
  const { data: current } = await ctx.db
    .from('types')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Type not found')
  }

  // Config mutations (types) are only allowed in master tenant by system admins
  if (!permissions.isSystemAdmin(ctx)) {
    throw new Error('Only system administrators can delete type configurations')
  }

  // System types can only be deleted by system admins (already checked above)
  // App types require app ownership verification
  if (current.ownership === 'app' && current.app_id) {
    // Verify user has access to this app
    const { data: appAccess } = await ctx.db
      .from('apps')
      .select('id')
      .eq('id', current.app_id)
      .eq('is_active', true)
      .single()
    
    if (!appAccess) {
      throw new Error('App not found or inactive')
    }
  }

  // Verify the current account is a master tenant (parent_id IS NULL)
  // Use adminDb for this check since we're verifying account structure
  const { data: accountData } = await adminDb
    .from('accounts')
    .select('parent_id')
    .eq('id', ctx.accountId!)
    .single()

  if (!accountData || accountData.parent_id !== null) {
    throw new Error('Type configurations can only be deleted in master tenant accounts')
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.deleted', { type: 'type', id }, { before: current })

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'
  const action = ctx.query?.action

  switch (method) {
    case 'GET':
      if (action === 'get' && ctx.query?.slug) {
        return await getBySlug(ctx, body)
      } else if (ctx.query?.id) {
        return await get(ctx, body)
      } else if (action === 'schema') {
        return await getSchema(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      return await create(ctx, body)
    case 'PATCH':
      return await update(ctx, body)
    case 'DELETE':
      return await remove(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
