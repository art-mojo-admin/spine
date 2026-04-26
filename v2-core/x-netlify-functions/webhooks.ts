import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List webhooks
export const list = createHandler(async (ctx, body) => {
  const { app_id, method, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('webhooks')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (method) {
    query = query.eq('method', method)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Get single webhook
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Webhook ID is required')
  }

  const { data, error: err } = await db
    .from('webhooks')
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

// Create webhook
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, url, method, headers, secret_key, signature_algorithm, timeout_seconds, retry_policy, event_filters, metadata } = body

  if (!name || !url) {
    throw new Error('name and url are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_webhook', {
      app_id,
      name,
      description,
      url,
      method: method || 'POST',
      headers: headers || {},
      secret_key,
      signature_algorithm: signature_algorithm || 'sha256',
      timeout_seconds: timeout_seconds || 30,
      retry_policy: retry_policy || { max_retries: 3, backoff_factor: 2 },
      event_filters: event_filters || [],
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'webhook.created', 
    { type: 'webhook', id: data }, 
    { after: { name, url } }
  )

  return { webhook_id: data }
}))

// Update webhook
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, url, method, headers, secret_key, signature_algorithm, timeout_seconds, retry_policy, event_filters, metadata } = body

  if (!id) {
    throw new Error('Webhook ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_webhook', {
      webhook_id: id,
      name,
      description,
      url,
      method,
      headers,
      secret_key,
      signature_algorithm,
      timeout_seconds,
      retry_policy,
      event_filters,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'webhook.updated', 
    { type: 'webhook', id }, 
    { after: { name, description } }
  )

  return { success: data }
}))

// Toggle webhook
export const toggle = requireAuth(createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Webhook ID and is_active are required')
  }

  const { data, error: err } = await db
    .rpc('toggle_webhook', {
      webhook_id: id,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'webhook.toggled', 
    { type: 'webhook', id }, 
    { after: { is_active } }
  )

  return { success: data }
}))

// Get webhooks for event
export const getForEvent = createHandler(async (ctx, body) => {
  const { event_type, app_id } = ctx.query || {}

  if (!event_type) {
    throw new Error('event_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_webhooks_for_event', {
      event_type,
      account_id: ctx.accountId,
      app_id: app_id || null
    })

  if (err) throw err

  return data
})

// List webhook deliveries
export const listDeliveries = createHandler(async (ctx, body) => {
  const { webhook_id, event_type, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('webhook_deliveries')
    .select(`
      *,
      webhook:webhooks(id, name, url)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (webhook_id) {
    query = query.eq('webhook_id', webhook_id)
  }
  if (event_type) {
    query = query.eq('event_type', event_type)
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

// Get single webhook delivery
export const getDelivery = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Delivery ID is required')
  }

  const { data, error: err } = await db
    .from('webhook_deliveries')
    .select(`
      *,
      webhook:webhooks(id, name, url)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create webhook delivery
export const createDelivery = requireAuth(createHandler(async (ctx, body) => {
  const { webhook_id, event_type, event_data, scheduled_at } = body

  if (!webhook_id || !event_type) {
    throw new Error('webhook_id and event_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_webhook_delivery', {
      webhook_id,
      event_type,
      event_data: event_data || {},
      scheduled_at: scheduled_at || new Date().toISOString()
    })

  if (err) throw err

  await emitLog(ctx, 'webhook_delivery.created', 
    { type: 'webhook_delivery', id: data }, 
    { after: { webhook_id, event_type } }
  )

  return { delivery_id: data }
}))

// Deliver webhook
export const deliver = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Delivery ID is required')
  }

  const { data, error: err } = await db
    .rpc('deliver_webhook', { delivery_id: id })

  if (err) throw err

  await emitLog(ctx, 'webhook_delivery.delivered', 
    { type: 'webhook_delivery', id }, 
    { after: { success: data[0]?.success, status: data[0]?.response_status } }
  )

  return data
}))

// Get webhook statistics
export const getStats = createHandler(async (ctx, body) => {
  const { webhook_id, date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_webhook_statistics', {
      webhook_id: webhook_id || null,
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Deliver webhooks batch
export const deliverBatch = requireAuth(createHandler(async (ctx, body) => {
  const { batch_size } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('deliver_webhooks_batch', {
      account_id: ctx.accountId,
      batch_size: batch_size || 50
    })

  if (err) throw err

  await emitLog(ctx, 'webhooks.delivered_batch', 
    { type: 'system', id: 'batch_deliver' }, 
    { after: { delivered_count: data[0]?.delivered_count } }
  )

  return data
}))

// Test webhook
export const test = requireAuth(createHandler(async (ctx, body) => {
  const { id, test_event_type, test_event_data } = body

  if (!id || !test_event_type) {
    throw new Error('Webhook ID and test_event_type are required')
  }

  // Create a test delivery
  const { data, error: err } = await db
    .rpc('create_webhook_delivery', {
      webhook_id: id,
      event_type: test_event_type,
      event_data: test_event_data || { test: true, timestamp: new Date().toISOString() },
      scheduled_at: new Date().toISOString()
    })

  if (err) throw err

  // Deliver the test
  const { data: deliveryResult, error: deliveryErr } = await db
    .rpc('deliver_webhook', { delivery_id: data })

  if (deliveryErr) throw deliveryErr

  await emitLog(ctx, 'webhook.tested', 
    { type: 'webhook', id }, 
    { after: { test_event_type, success: deliveryResult[0]?.success } }
  )

  return {
    delivery_id: data,
    result: deliveryResult[0]
  }
}))

// Cleanup old deliveries
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep, status_filter } = body

  const { data, error: err } = await db
    .rpc('cleanup_webhook_deliveries', {
      days_to_keep: days_to_keep || 30,
      status_filter: status_filter || null
    })

  if (err) throw err

  await emitLog(ctx, 'webhook_deliveries.cleaned', 
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
    case 'for-event':
      if (method === 'GET') {
        return await getForEvent(ctx, body)
      }
      break
    case 'deliveries':
      if (method === 'GET') {
        return await listDeliveries(ctx, body)
      }
      break
    case 'delivery':
      if (method === 'GET') {
        return await getDelivery(ctx, body)
      } else if (method === 'POST') {
        return await createDelivery(ctx, body)
      } else if (method === 'PATCH') {
        return await deliver(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'deliver-batch':
      if (method === 'POST') {
        return await deliverBatch(ctx, body)
      }
      break
    case 'test':
      if (method === 'POST') {
        return await test(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
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
