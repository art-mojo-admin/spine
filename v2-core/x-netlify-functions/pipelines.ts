import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List pipelines by trigger type
export const listByTrigger = createHandler(async (ctx, body) => {
  const { trigger_type, app_id, include_inactive } = ctx.query || {}

  if (!trigger_type) {
    throw new Error('trigger_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_pipelines_by_trigger', {
      trigger_type,
      account_id: ctx.accountId,
      app_id: app_id || null,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// List all pipelines
export const list = createHandler(async (ctx, body) => {
  const { app_id, include_inactive } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('pipelines')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)

  if (app_id) {
    query = query.eq('app_id', app_id)
  }

  const { data, error: err } = await query.order('name')

  if (err) throw err

  return data
})

// Get single pipeline
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await db
    .from('pipelines')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create pipeline
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, trigger_type, config, stages, metadata } = body

  if (!name || !trigger_type || !stages) {
    throw new Error('name, trigger_type, and stages are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_pipeline', {
      app_id,
      name,
      description,
      trigger_type,
      config: config || {},
      stages,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline.created', 
    { type: 'pipeline', id: data }, 
    { after: { name, trigger_type } }
  )

  return { pipeline_id: data }
}))

// Update pipeline
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, config, stages, metadata } = body

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_pipeline', {
      pipeline_id: id,
      name,
      description,
      config,
      stages,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline.updated', 
    { type: 'pipeline', id }, 
    { after: { name, description } }
  )

  return { success: data }
}))

// Toggle pipeline (activate/deactivate)
export const toggle = requireAuth(createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Pipeline ID and is_active are required')
  }

  const { data, error: err } = await db
    .rpc('toggle_pipeline', {
      pipeline_id: id,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline.toggled', 
    { type: 'pipeline', id }, 
    { after: { is_active } }
  )

  return { success: data }
}))

// Validate pipeline configuration
export const validate = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await db
    .rpc('validate_pipeline', { pipeline_id: id })

  if (err) throw err

  return data
})

// Get pipeline execution history
export const getExecutions = createHandler(async (ctx, body) => {
  const { pipeline_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!pipeline_id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_pipeline_executions', {
      pipeline_id,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Execute pipeline manually
export const execute = requireAuth(createHandler(async (ctx, body) => {
  const { pipeline_id, input_data } = body

  if (!pipeline_id) {
    throw new Error('Pipeline ID is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_pipeline_execution', {
      pipeline_id,
      input_data: input_data || {},
      context: {},
      triggered_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline.executed', 
    { type: 'pipeline_execution', id: data }, 
    { after: { pipeline_id, triggered_by: ctx.personId } }
  )

  return { execution_id: data }
}))

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
    case 'validate':
      if (method === 'GET') {
        return await validate(ctx, body)
      }
      break
    case 'executions':
      if (method === 'GET') {
        return await getExecutions(ctx, body)
      }
      break
    case 'execute':
      if (method === 'POST') {
        return await execute(ctx, body)
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
      }
  }

  throw new Error('Invalid action or method')
})
