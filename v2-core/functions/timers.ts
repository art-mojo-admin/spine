import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// List timers - RLS enforced
export const list = createHandler(async (ctx, _body) => {
  const { app_id, timer_type, is_active } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('timers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (timer_type) {
    query = query.eq('timer_type', timer_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }

  const { data, error: err } = await query

  if (err) throw err

  const sanitized = []
  for (const timer of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, timer, 'timer'))
  }

  return sanitized
})

// Get single timer - RLS enforced
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'timer')
})

// Create timer
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, timer_type, config, pipeline_id, metadata } = body

  if (!name || !timer_type) {
    throw new Error('name and timer_type are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      timer_type,
      config: config || {},
      pipeline_id: pipeline_id || null,
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'timer.created', 
    { type: 'timer', id: data.id }, 
    { after: { name, timer_type } }
  )

  return data
})

// Update timer
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const allowed = ['name', 'description', 'config', 'pipeline_id', 'metadata', 'is_active']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'timer.updated', 
    { type: 'timer', id }, 
    { after: updateData }
  )

  return data
})

// Toggle timer (activate/deactivate)
export const toggle = createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Timer ID and is_active are required')
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'timer.toggled', 
    { type: 'timer', id }, 
    { after: { is_active } }
  )

  return data
})

// Delete timer
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data: current } = await ctx.db
    .from('timers')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Timer not found')

  const { error: err } = await ctx.db
    .from('timers')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'timer.deleted', 
    { type: 'timer', id }, 
    { before: current }
  )

  return { success: true }
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
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
