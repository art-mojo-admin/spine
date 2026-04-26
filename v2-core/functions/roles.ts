import { createHandler } from './_shared/middleware'
import { adminDb } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

// Type assertion to ensure we're using the instance
const permissions = PermissionEngine as any

// List roles - RLS enforced via ctx.db
export const list = createHandler(async (ctx, _body) => {
  const { app_id, is_system, limit = '50', offset = '0' } = ctx.query || {}

  // RLS automatically filters to accessible roles
  let query = ctx.db
    .from('roles')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('is_active', true)
    .order('is_system', { ascending: false })
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else if (app_id === 'null') {
    query = query.is('app_id', null)
  }

  if (is_system !== undefined) {
    query = query.eq('is_system', is_system === 'true')
  }

  const { data, error: err } = await query
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (err) throw err

  // System admin sees everything without additional filtering
  if (permissions.isSystemAdmin(ctx)) {
    return data
  }

  // Filter each role based on field-level permissions
  const filteredData = []
  for (const role of data || []) {
    const roleWithType = { ...role, type: 'role' }
    const sanitizedRole = await sanitizeRecordData(ctx, roleWithType, 'role')
      filteredData.push(sanitizedRole)
  }

  return filteredData
})

// Get single role - RLS enforced via ctx.db
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Role ID is required')
  }

  // RLS ensures user can only access roles in their accessible accounts
  const { data, error: err } = await ctx.db
    .from('roles')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Return sanitized data based on field-level permissions
  const roleWithType = { ...data, type: 'role' }
  return await sanitizeRecordData(ctx, roleWithType, 'role')
})

// Create role - RLS enforced via ctx.db
export const create = createHandler(async (ctx, body) => {
  const { app_id, slug, name, description, permissions: rolePermissions, is_system } = body

  if (!slug || !name) {
    throw new Error('slug and name are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Guard: system_admin role can only be created by system admins
  if (slug === 'system_admin' && !permissions.isSystemAdmin(ctx)) {
    throw new Error('system_admin role can only be created by system administrators')
  }

  // Check create permissions using PermissionEngine
  if (!permissions.isSystemAdmin(ctx)) {
    const perms = await permissions.resolveFirstSurfacePermissions(
      ctx.principal.id,
      ctx.accountId!,
      'role',
      'create'
    )
    
    if (!perms.canCreate) {
      throw new Error('Insufficient permissions to create roles')
    }
  }

  // Check if slug is unique within app using service role (validating uniqueness is a system concern)
  let query = adminDb
    .from('roles')
    .select('id')
    .eq('slug', slug)

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else {
    query = query.is('app_id', null)
  }

  const { data: existing } = await query.single()

  if (existing) {
    throw new Error('Role slug already exists for this app')
  }

  // Insert with RLS enforcement
  const { data, error: err } = await ctx.db
    .from('roles')
    .insert({
      app_id,
      slug,
      name,
      description,
      permissions: rolePermissions || {},
      is_system: is_system || false,
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.created', { type: 'role', id: data.id }, { after: data })

  return data
})

// Update role - RLS enforced via ctx.db
export const update = createHandler(async (ctx, body) => {
  const { id, ...updates } = body

  if (!id) {
    throw new Error('Role ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit via RLS
  const { data: current, error: fetchErr } = await ctx.db
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    throw new Error('Role not found or access denied')
  }

  // Validate field-level permissions
  const fieldValidation = await permissions.validateUpdatePermissions(
    ctx,
    updates,
    current,
    'role'
  )
  
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error)
  }

  // Update via RLS
  const { data, error: err } = await ctx.db
    .from('roles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.updated', { type: 'role', id }, { before: current, after: data })

  return data
})

// Soft delete role - RLS enforced via ctx.db
export const remove = createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Role ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Verify access via RLS fetch
  const { data: current, error: fetchErr } = await ctx.db
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    throw new Error('Role not found or access denied')
  }

  // Soft delete via RLS
  const { data, error: err } = await ctx.db
    .from('roles')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.deleted', { type: 'role', id }, { before: current })

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.id) {
        return await get(ctx, body)
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
