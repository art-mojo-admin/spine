import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

// Get account logs
export const listAccount = createHandler(async (ctx, body) => {
  const { event_type, target_type, date_from, date_to, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_account_logs', {
      account_id: ctx.accountId,
      event_type: event_type || null,
      target_type: target_type || null,
      date_from: date_from || null,
      date_to: date_to || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Get logs for target
export const listTarget = createHandler(async (ctx, body) => {
  const { target_type, target_id, event_type, limit = 100, offset = 0 } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_target_logs', {
      target_type,
      target_id,
      account_id: ctx.accountId,
      event_type: event_type || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Get person activity feed
export const listPerson = createHandler(async (ctx, body) => {
  const { person_id, include_system, limit = 50, offset = 0 } = ctx.query || {}

  const targetPersonId = person_id || ctx.personId

  if (!targetPersonId) {
    throw new Error('Person ID is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_person_activity', {
      person_id: targetPersonId,
      account_id: ctx.accountId,
      include_system: include_system === 'true',
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Get log statistics
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_log_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Search logs
export const search = createHandler(async (ctx, body) => {
  const { query, event_type, target_type, limit = 50, offset = 0 } = ctx.query || {}

  if (!query) {
    throw new Error('Search query is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('search_logs', {
      account_id: ctx.accountId,
      query,
      event_type: event_type || null,
      target_type: target_type || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Log event (for internal use)
export const log = createHandler(async (ctx, body) => {
  const { event_type, target_type, target_id, action, details, metadata } = body

  if (!event_type) {
    throw new Error('event_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('log_event', {
      event_type,
      actor_id: ctx.personId,
      target_type: target_type || null,
      target_id: target_id || null,
      action: action || null,
      details: details || {},
      metadata: metadata || {},
      account_id: ctx.accountId,
      app_id: ctx.appId || null
    })

  if (err) throw err

  return { log_id: data }
})

// Cleanup old logs (admin only)
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const { data, error: err } = await db
    .rpc('cleanup_old_logs', {
      days_to_keep: days_to_keep || 90
    })

  if (err) throw err

  return { deleted_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'account':
      if (method === 'GET') {
        return await listAccount(ctx, body)
      }
      break
    case 'target':
      if (method === 'GET') {
        return await listTarget(ctx, body)
      }
      break
    case 'person':
      if (method === 'GET') {
        return await listPerson(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'search':
      if (method === 'GET') {
        return await search(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
      }
      break
    default:
      if (method === 'POST') {
        return await log(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
