import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List roles
export const list = createHandler(async (ctx, body) => {
  const { app_id, is_system, limit = 50, offset = 0 } = ctx.query || {}

  let query = db
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

  return data
})

// Get single role
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Role ID is required')
  }

  const { data, error: err } = await db
    .from('roles')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  return data
})

// Get role permissions
export const getPermissions = createHandler(async (ctx, body) => {
  const { slug, app_id } = ctx.query || {}

  if (!slug) {
    throw new Error('Role slug is required')
  }

  const { data, error: err } = await db
    .rpc('get_role_permissions', {
      role_slug: slug,
      app_id: app_id || null
    })

  if (err) throw err

  return { permissions: data }
})

// Create role
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, slug, name, description, permissions, is_system } = body

  if (!slug || !name) {
    throw new Error('slug and name are required')
  }

  // Check if slug is unique within app
  let query = db
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

  const { data, error: err } = await db
    .from('roles')
    .insert({
      app_id,
      slug,
      name,
      description,
      permissions: permissions || {},
      is_system: is_system || false,
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.created', { type: 'role', id: data.id }, { after: data })

  return data
}))

// Update role
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, ...updates } = body

  if (!id) {
    throw new Error('Role ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Role not found')
  }

  const { data, error: err } = await db
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
}))

// Soft delete role
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Role ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Role not found')
  }

  const { data, error: err } = await db
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
}))

// Check role permission
export const checkPermission = createHandler(async (ctx, body) => {
  const { slug, permission, app_id } = ctx.query || {}

  if (!slug || !permission) {
    throw new Error('Role slug and permission are required')
  }

  const { data, error: err } = await db
    .rpc('role_has_permission', {
      role_slug: slug,
      permission,
      app_id: app_id || null
    })

  if (err) throw err

  return { has_permission: data }
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.id) {
        return await get(ctx, body)
      } else if (ctx.query?.action === 'permissions') {
        return await getPermissions(ctx, body)
      } else if (ctx.query?.action === 'check') {
        return await checkPermission(ctx, body)
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
