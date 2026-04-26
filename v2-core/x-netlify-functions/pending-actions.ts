import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List pending actions
export const list = createHandler(async (ctx, body) => {
  const { action_type, target_type, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('pending_actions')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('priority DESC, scheduled_at ASC')

  if (action_type) {
    query = query.eq('action_type', action_type)
  }
  if (target_type) {
    query = query.eq('target_type', target_type)
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

// Get single pending action
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Action ID is required')
  }

  const { data, error: err } = await db
    .from('pending_actions')
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

// Create pending action
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, action_type, target_type, target_id, action_data, priority, scheduled_at, max_retries, metadata } = body

  if (!action_type || !target_type) {
    throw new Error('action_type and target_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_pending_action', {
      app_id,
      action_type,
      target_type,
      target_id,
      action_data: action_data || {},
      priority: priority || 0,
      scheduled_at: scheduled_at || new Date().toISOString(),
      max_retries: max_retries || 3,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'pending_action.created', 
    { type: 'pending_action', id: data }, 
    { after: { action_type, target_type } }
  )

  return { action_id: data }
}))

// Execute pending action
export const execute = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Action ID is required')
  }

  const { data, error: err } = await db
    .rpc('execute_pending_action', { action_id: id })

  if (err) throw err

  await emitLog(ctx, 'pending_action.executed', 
    { type: 'pending_action', id }, 
    { after: { success: data[0]?.success } }
  )

  return data
}))

// Get pending actions for processing
export const getPending = createHandler(async (ctx, body) => {
  const { action_type, target_type, limit = 100, priority_filter } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_pending_actions', {
      account_id: ctx.accountId,
      action_type: action_type || null,
      target_type: target_type || null,
      limit: parseInt(limit.toString()),
      priority_filter: priority_filter ? parseInt(priority_filter.toString()) : null
    })

  if (err) throw err

  return data
})

// Retry failed actions
export const retryFailed = requireAuth(createHandler(async (ctx, body) => {
  const { action_type, hours_back } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('retry_failed_actions', {
      account_id: ctx.accountId,
      action_type: action_type || null,
      hours_back: hours_back || 1
    })

  if (err) throw err

  await emitLog(ctx, 'pending_actions.retried', 
    { type: 'system', id: 'batch_retry' }, 
    { after: { retried_count: data[0]?.retried_count } }
  )

  return data
}))

// Cancel pending actions
export const cancel = requireAuth(createHandler(async (ctx, body) => {
  const { action_type, target_type, target_id } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('cancel_pending_actions', {
      account_id: ctx.accountId,
      action_type: action_type || null,
      target_type: target_type || null,
      target_id
    })

  if (err) throw err

  await emitLog(ctx, 'pending_actions.cancelled', 
    { type: 'system', id: 'batch_cancel' }, 
    { after: { cancelled_count: data[0]?.cancelled_count } }
  )

  return data
}))

// Get action statistics
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_pending_action_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Process batch
export const processBatch = requireAuth(createHandler(async (ctx, body) => {
  const { batch_size } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('process_pending_actions_batch', {
      account_id: ctx.accountId,
      batch_size: batch_size || 50
    })

  if (err) throw err

  await emitLog(ctx, 'pending_actions.processed_batch', 
    { type: 'system', id: 'batch_process' }, 
    { after: { processed_count: data[0]?.processed_count } }
  )

  return data
}))

// Cleanup old actions
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep, status_filter } = body

  const { data, error: err } = await db
    .rpc('cleanup_pending_actions', {
      days_to_keep: days_to_keep || 30,
      status_filter: status_filter || null
    })

  if (err) throw err

  await emitLog(ctx, 'pending_actions.cleaned', 
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
    case 'pending':
      if (method === 'GET') {
        return await getPending(ctx, body)
      }
      break
    case 'retry-failed':
      if (method === 'POST') {
        return await retryFailed(ctx, body)
      }
      break
    case 'cancel':
      if (method === 'POST') {
        return await cancel(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'process-batch':
      if (method === 'POST') {
        return await processBatch(ctx, body)
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
        return await execute(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
