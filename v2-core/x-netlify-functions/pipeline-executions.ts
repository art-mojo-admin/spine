import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List executions
export const list = createHandler(async (ctx, body) => {
  const { pipeline_id, status, limit = 100, offset = 0 } = ctx.query || {}

  let query = db
    .from('pipeline_executions')
    .select(`
      *,
      pipeline:pipelines(id, name, trigger_type),
      triggered_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId!)
    .order('started_at', { ascending: false })

  if (pipeline_id) {
    query = query.eq('pipeline_id', pipeline_id)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Get single execution
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_pipeline_execution', { execution_id: id })

  if (err) throw err

  return data
})

// Create execution
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { pipeline_id, input_data, context } = body

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
      context: context || {},
      triggered_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.created', 
    { type: 'pipeline_execution', id: data }, 
    { after: { pipeline_id } }
  )

  return { execution_id: data }
}))

// Start execution
export const start = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await db
    .rpc('start_pipeline_execution', { execution_id: id })

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.started', 
    { type: 'pipeline_execution', id }, 
    { after: { status: 'running' } }
  )

  return { success: data }
}))

// Complete execution
export const complete = requireAuth(createHandler(async (ctx, body) => {
  const { id, output_data, error_message } = body

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await db
    .rpc('complete_pipeline_execution', {
      execution_id: id,
      output_data: output_data || {},
      error_message
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.completed', 
    { type: 'pipeline_execution', id }, 
    { after: { status: error_message ? 'failed' : 'completed', error_message } }
  )

  return { success: data }
}))

// Cancel execution
export const cancel = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await db
    .rpc('cancel_pipeline_execution', { execution_id: id })

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.cancelled', 
    { type: 'pipeline_execution', id }, 
    { after: { status: 'cancelled' } }
  )

  return { success: data }
}))

// Get running executions
export const getRunning = createHandler(async (ctx, body) => {
  const { pipeline_id } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_running_executions', {
      account_id: ctx.accountId,
      pipeline_id: pipeline_id || null
    })

  if (err) throw err

  return data
})

// Get execution statistics
export const getStats = createHandler(async (ctx, body) => {
  const { pipeline_id, date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_execution_statistics', {
      pipeline_id: pipeline_id || null,
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Cleanup old executions
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep, status_filter } = body

  const { data, error: err } = await db
    .rpc('cleanup_executions', {
      days_to_keep: days_to_keep || 30,
      status_filter: status_filter || null
    })

  if (err) throw err

  await emitLog(ctx, 'pipeline_executions.cleaned', 
    { type: 'system', id: 'cleanup' }, 
    { after: { deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'running':
      if (method === 'GET') {
        return await getRunning(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
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
        if (ctx.query?.action === 'start') {
          return await start(ctx, body)
        } else if (ctx.query?.action === 'complete') {
          return await complete(ctx, body)
        } else if (ctx.query?.action === 'cancel') {
          return await cancel(ctx, body)
        }
      }
  }

  throw new Error('Invalid action or method')
})
