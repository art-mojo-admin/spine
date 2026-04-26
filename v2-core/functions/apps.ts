import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

// Type assertion to ensure we're using the instance
const permissions = PermissionEngine as any

// List apps - RLS enforced via ctx.db
export const list = createHandler(async (ctx, body) => {
  const { include_system, include_inactive, account_id } = ctx.query || {}

  const targetAccountId = account_id || ctx.accountId

  if (!targetAccountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  const { data, error: err } = await ctx.db
    .rpc('get_account_apps', {
      account_id: targetAccountId,
      include_system: include_system !== 'false',
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const app of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, app, 'app'))
  }

  return sanitized
})

// Get single app - RLS enforced
export const get = createHandler(async (ctx, body) => {
  const { id, slug } = ctx.query || {}
  
  if (!id && !slug) {
    throw new Error('App ID or slug is required')
  }

  let query = ctx.db
    .from('apps')
    .select(`*, ${joins.ownerAccount}`)
    .eq('is_active', true)

  if (id) {
    query = query.eq('id', id)
  } else {
    query = query.eq('slug', slug)
  }

  const { data, error: err } = await query.single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'app')
})

// Get app schema - RLS enforced via RPC
export const getSchema = createHandler(async (ctx, body) => {
  const { slug } = ctx.query || {}

  if (!slug) {
    throw new Error('App slug is required')
  }

  const { data, error: err } = await ctx.db
    .rpc('get_app_schema', { app_slug: slug })

  if (err) throw err

  return data
})

// Create app - RLS enforced
export const create = createHandler(async (ctx, body) => {
  const { slug, name, description, icon, color, version, app_type, source, owner_account_id, config, nav_items, min_role, integration_deps, metadata } = body

  if (!slug || !name) {
    throw new Error('slug and name are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Check create permissions
  if (!permissions.isSystemAdmin(ctx)) {
    const perms = await permissions.resolveFirstSurfacePermissions(
      ctx.principal.id,
      ctx.accountId!,
      'app',
      'create'
    )
    
    if (!perms.canCreate) {
      throw new Error('Insufficient permissions to create apps')
    }
  }

  // Check if slug is unique
  const { data: existing } = await ctx.db
    .from('apps')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    throw new Error('App slug already exists')
  }

  const { data, error: err } = await ctx.db
    .from('apps')
    .insert({
      slug,
      name,
      description,
      icon,
      color,
      version: version || '1.0.0',
      app_type: app_type || 'custom',
      source: source || 'custom',
      owner_account_id: owner_account_id || ctx.accountId,
      config: config || {},
      nav_items: nav_items || [],
      min_role: min_role || 'member',
      integration_deps: integration_deps || [],
      metadata: metadata || {},
      is_active: true,
      is_system: false
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app.created', { type: 'app', id: data.id }, { after: data })

  return data
})

// Update app - RLS enforced
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('App ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible apps
  const { data: current } = await ctx.db
    .from('apps')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('App not found')
  }

  // Validate field-level permissions
  const fieldValidation = await permissions.validateUpdatePermissions(
    ctx,
    updates,
    current,
    'app'
  )
  
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error)
  }

  const { data, error: err } = await ctx.db
    .from('apps')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app.updated', { type: 'app', id }, { before: current, after: data })

  return data
})

// Soft delete app - RLS enforced
export const remove = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id

  if (!id) {
    throw new Error('App ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible apps
  const { data: current } = await ctx.db
    .from('apps')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('App not found')
  }

  const { data, error: err } = await ctx.db
    .from('apps')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app.deleted', { type: 'app', id }, { before: current })

  return data
})

// Check if app is available - RLS enforced via RPC
export const checkAvailability = createHandler(async (ctx, body) => {
  const { slug } = ctx.query || {}

  if (!slug) {
    throw new Error('App slug is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .rpc('is_app_available', {
      app_slug: slug,
      account_id: ctx.accountId
    })

  if (err) throw err

  return { available: data }
})

// Update app version - RLS enforced via RPC
export const updateVersion = createHandler(async (ctx, body) => {
  const { id, version } = body

  if (!id || !version) {
    throw new Error('App ID and version are required')
  }

  const { data, error: err } = await ctx.db
    .rpc('update_app_version', {
      app_id: id,
      new_version: version
    })

  if (err) throw err

  await emitLog(ctx, 'app.version_updated', { type: 'app', id }, { after: { version } })

  return { success: true }
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.action === 'get' || ctx.query?.id) {
        return await get(ctx, body)
      } else if (ctx.query?.slug) {
        return await get(ctx, body)
      } else if (ctx.query?.action === 'schema') {
        return await getSchema(ctx, body)
      } else if (ctx.query?.action === 'available') {
        return await checkAvailability(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      if (ctx.query?.action === 'version') {
        return await updateVersion(ctx, body)
      } else {
        return await create(ctx, body)
      }
    case 'PATCH':
      return await update(ctx, body)
    case 'DELETE':
      return await remove(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
