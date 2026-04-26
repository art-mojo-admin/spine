import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List outbox events
export const list = createHandler(async (ctx, body) => {
  const { event_type, destination_type, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('outbox')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('account_id', ctx.accountId)
    .order('priority DESC, scheduled_at ASC')

  if (event_type) {
    query = query.eq('event_type', event_type)
  }
  if (destination_type) {
    query = query.eq('destination_type', destination_type)
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

// Get single outbox event
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Event ID is required')
  }

  const { data, error: err } = await db
    .from('outbox')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create outbox event
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, event_type, event_data, destination_type, destination_config, priority, scheduled_at, max_retries, metadata } = body

  if (!event_type || !destination_type) {
    throw new Error('event_type and destination_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_outbox_event', {
      app_id,
      event_type,
      event_data: event_data || {},
      destination_type,
      destination_config: destination_config || {},
      priority: priority || 0,
      scheduled_at: scheduled_at || new Date().toISOString(),
      max_retries: max_retries || 3,
      metadata: metadata || {},
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'outbox_event.created', 
    { type: 'outbox_event', id: data }, 
    { after: { event_type, destination_type } }
  )

  return { event_id: data }
}))

// Send outbox event
export const send = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Event ID is required')
  }

  const { data, error: err } = await db
    .rpc('send_outbox_event', { event_id: id })

  if (err) throw err

  await emitLog(ctx, 'outbox_event.sent', 
    { type: 'outbox_event', id }, 
    { after: { success: data[0]?.success } }
  )

  return data
}))

// Get pending outbox events
export const getPending = createHandler(async (ctx, body) => {
  const { destination_type, event_type, limit = 100, priority_filter } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_pending_outbox_events', {
      account_id: ctx.accountId,
      destination_type: destination_type || null,
      event_type: event_type || null,
      limit: parseInt(limit.toString()),
      priority_filter: priority_filter ? parseInt(priority_filter.toString()) : null
    })

  if (err) throw err

  return data
})

// Retry failed events
export const retryFailed = requireAuth(createHandler(async (ctx, body) => {
  const { destination_type, hours_back } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('retry_failed_outbox_events', {
      account_id: ctx.accountId,
      destination_type: destination_type || null,
      hours_back: hours_back || 1
    })

  if (err) throw err

  await emitLog(ctx, 'outbox_events.retried', 
    { type: 'system', id: 'batch_retry' }, 
    { after: { retried_count: data[0]?.retried_count } }
  )

  return data
}))

// Cancel pending events
export const cancel = requireAuth(createHandler(async (ctx, body) => {
  const { destination_type, event_type } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('cancel_pending_outbox_events', {
      account_id: ctx.accountId,
      destination_type: destination_type || null,
      event_type: event_type || null
    })

  if (err) throw err

  await emitLog(ctx, 'outbox_events.cancelled', 
    { type: 'system', id: 'batch_cancel' }, 
    { after: { cancelled_count: data[0]?.cancelled_count } }
  )

  return data
}))

// Get outbox statistics
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_outbox_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Send batch
export const sendBatch = requireAuth(createHandler(async (ctx, body) => {
  const { batch_size } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('send_outbox_events_batch', {
      account_id: ctx.accountId,
      batch_size: batch_size || 50
    })

  if (err) throw err

  await emitLog(ctx, 'outbox_events.sent_batch', 
    { type: 'system', id: 'batch_send' }, 
    { after: { sent_count: data[0]?.sent_count } }
  )

  return data
}))

// Publish event (helper)
export const publish = requireAuth(createHandler(async (ctx, body) => {
  const { event_type, event_data, destination_type, destination_config, app_id } = body

  if (!event_type || !destination_type) {
    throw new Error('event_type and destination_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('publish_event', {
      event_type,
      event_data: event_data || {},
      destination_type,
      destination_config: destination_config || {},
      app_id,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'event.published', 
    { type: 'outbox_event', id: data }, 
    { after: { event_type, destination_type } }
  )

  return { event_id: data }
}))

// Cleanup old events
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep, status_filter } = body

  const { data, error: err } = await db
    .rpc('cleanup_outbox_events', {
      days_to_keep: days_to_keep || 30,
      status_filter: status_filter || null
    })

  if (err) throw err

  await emitLog(ctx, 'outbox_events.cleaned', 
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
    case 'send-batch':
      if (method === 'POST') {
        return await sendBatch(ctx, body)
      }
      break
    case 'publish':
      if (method === 'POST') {
        return await publish(ctx, body)
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
        return await send(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
