import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// List pipelines by trigger type - RLS enforced
export const listByTrigger = createHandler(async (ctx, _body) => {
  const { trigger_type, app_id, include_inactive } = ctx.query || {}

  if (!trigger_type) {
    throw new Error('trigger_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('pipelines')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('trigger_type', trigger_type)

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query.order('name')

  if (err) throw err

  const sanitized = []
  for (const pipeline of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, pipeline, 'pipeline'))
  }

  return sanitized
})

// List all pipelines - RLS enforced
export const list = createHandler(async (ctx, body) => {
  const { app_id, include_inactive } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('pipelines')
    .select(`*, ${joins.app}, ${joins.createdBy}`)

  if (app_id) {
    query = query.eq('app_id', app_id)
  }

  const { data, error: err } = await query.order('name')

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const pipeline of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, pipeline, 'pipeline'))
  }

  return sanitized
})

// Get single pipeline - RLS enforced
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'pipeline')
})

// Create pipeline
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, trigger_type, config, stages, metadata } = body

  if (!name || !trigger_type || !stages) {
    throw new Error('name, trigger_type, and stages are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      trigger_type,
      config: config || {},
      stages,
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline.created', 
    { type: 'pipeline', id: data.id }, 
    { after: { name, trigger_type } }
  )

  return data
})

// Update pipeline - RLS enforced
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, name, description, config, stages, metadata } = body || {}

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible pipelines
  const { data: current } = await ctx.db
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Pipeline not found')
  }

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (config !== undefined) updateData.config = config
  if (stages !== undefined) updateData.stages = stages
  if (metadata !== undefined) updateData.metadata = metadata

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline.updated', 
    { type: 'pipeline', id }, 
    { before: current, after: updateData }
  )

  return data
})

// Toggle pipeline (activate/deactivate) - RLS enforced
export const toggle = createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Pipeline ID and is_active are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible pipelines
  const { data: current } = await ctx.db
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Pipeline not found')
  }

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline.toggled', 
    { type: 'pipeline', id }, 
    { before: { is_active: current.is_active }, after: { is_active } }
  )

  return data
})

// Get pipeline execution history
export const getExecutions = createHandler(async (ctx, _body) => {
  const { pipeline_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!pipeline_id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .select('*')
    .eq('pipeline_id', pipeline_id)
    .order('created_at', { ascending: false })
    .range(
      parseInt(offset.toString()),
      parseInt(offset.toString()) + parseInt(limit.toString()) - 1
    )

  if (err) throw err

  return data
})

// Delete pipeline
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data: current } = await ctx.db
    .from('pipelines')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Pipeline not found')

  const { error: err } = await ctx.db
    .from('pipelines')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'pipeline.deleted', 
    { type: 'pipeline', id }, 
    { before: current }
  )

  return { success: true }
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'by-trigger':
      if (method === 'GET') {
        return await listByTrigger(ctx, body)
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
