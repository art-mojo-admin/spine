import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

// Type assertion to ensure we're using the instance
const permissions = PermissionEngine as any

// List triggers by event type - RLS enforced
export const listByEvent = createHandler(async (ctx, body) => {
  const { event_type, app_id, include_inactive } = ctx.query || {}

  if (!event_type) {
    throw new Error('event_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('triggers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('event_type', event_type)
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const trigger of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, trigger, 'trigger'))
  }

  return sanitized
})

// List all triggers - RLS enforced
export const list = createHandler(async (ctx, body) => {
  const { app_id, event_type, include_inactive } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('triggers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (event_type) {
    query = query.eq('event_type', event_type)
  }
  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const trigger of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, trigger, 'trigger'))
  }

  return sanitized
})

// Get single trigger - RLS enforced
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'trigger')
})

// Create trigger - RLS enforced
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, trigger_type, event_type, config, pipeline_id, metadata, is_active } = body

  if (!name || !trigger_type) {
    throw new Error('name and trigger_type are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Check create permissions
  if (!permissions.isSystemAdmin(ctx)) {
    const perms = await permissions.resolveFirstSurfacePermissions(
      ctx.principal.id,
      ctx.accountId!,
      'trigger',
      'create'
    )
    
    if (!perms.canCreate) {
      throw new Error('Insufficient permissions to create triggers')
    }
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .insert({
      app_id,
      name,
      description,
      trigger_type,
      event_type,
      config: config || {},
      pipeline_id: pipeline_id || null,
      metadata: metadata || {},
      is_active: is_active ?? true,
      created_by: ctx.principal.id,
      account_id: ctx.accountId
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.created', 
    { type: 'trigger', id: data.id }, 
    { after: data }
  )

  return data
})

// Update trigger - RLS enforced
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, app_id, name, description, trigger_type, event_type, config, pipeline_id, metadata, is_active } = body || {}

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible triggers
  const { data: current } = await ctx.db
    .from('triggers')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Trigger not found')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .update({
      app_id,
      name,
      description,
      trigger_type,
      event_type,
      config,
      pipeline_id,
      metadata,
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.updated', 
    { type: 'trigger', id }, 
    { before: current, after: data }
  )

  return data
})

// Soft delete trigger - RLS enforced
export const remove = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible triggers
  const { data: current } = await ctx.db
    .from('triggers')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Trigger not found')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.deleted',
    { type: 'trigger', id },
    { before: current, after: data }
  )

  return data
})

// Toggle trigger (activate/deactivate) - RLS enforced
export const toggle = createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Trigger ID and is_active are required')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .update({
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.toggled', 
    { type: 'trigger', id }, 
    { after: { is_active } }
  )

  return data
})

// Get trigger execution history - RLS enforced
export const getExecutions = createHandler(async (ctx, body) => {
  const { trigger_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!trigger_id) {
    throw new Error('Trigger ID is required')
  }

  const parsedLimit = parseInt(limit.toString())
  const parsedOffset = parseInt(offset.toString())

  const { data, error: err } = await ctx.db
    .from('trigger_executions')
    .select('*')
    .eq('trigger_id', trigger_id)
    .order('triggered_at', { ascending: false })
    .range(parsedOffset, parsedOffset + parsedLimit - 1)

  if (err) throw err

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'by-event':
      if (method === 'GET') {
        return await listByEvent(ctx, body)
      }
      break
    case 'executions':
      if (method === 'GET') {
        return await getExecutions(ctx, body)
      }
      break
    case 'toggle':
      if (method === 'POST') {
        return await toggle(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        if (ctx.query?.id) {
          return await get(ctx, body)
        } else {
          return await list(ctx, body)
        }
      } else if (method === 'POST') {
        return await create(ctx, body)
      } else if (method === 'PATCH') {
        return await update(ctx, body)
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
