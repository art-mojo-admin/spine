import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List API keys
export const list = createHandler(async (ctx, body) => {
  const { integration_id, key_type, is_active, expires_before, expires_after, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('api_keys')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (integration_id) {
    query = query.eq('integration_id', integration_id)
  }
  if (key_type) {
    query = query.eq('key_type', key_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }
  if (expires_before) {
    query = query.lte('expires_at', expires_before)
  }
  if (expires_after) {
    query = query.gte('expires_at', expires_after)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Get single API key
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await db
    .from('api_keys')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create API key
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { integration_id, name, key_type, key_prefix, permissions, rate_limit, expires_at, metadata } = body

  if (!name) {
    throw new Error('name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_api_key', {
      integration_id,
      name,
      key_type: key_type || 'private',
      key_prefix: key_prefix || 'sk_',
      permissions: permissions || {},
      rate_limit: rate_limit || 1000,
      expires_at,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'api_key.created', 
    { type: 'api_key', id: data[0]?.api_key_id }, 
    { after: { name, key_type, rate_limit } }
  )

  return data
}))

// Validate API key
export const validate = createHandler(async (ctx, body) => {
  const { key_value, required_permissions } = body

  if (!key_value) {
    throw new Error('key_value is required')
  }

  const { data, error: err } = await db
    .rpc('validate_api_key', {
      key_value,
      required_permissions: required_permissions || {}
    })

  if (err) throw err

  return data
})

// Rotate API key
export const rotate = requireAuth(createHandler(async (ctx, body) => {
  const { id, keep_old_key } = body

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await db
    .rpc('rotate_api_key', {
      api_key_id: id,
      keep_old_key: keep_old_key || false
    })

  if (err) throw err

  await emitLog(ctx, 'api_key.rotated', 
    { type: 'api_key', id }, 
    { after: { keep_old_key } }
  )

  return data
}))

// Revoke API key
export const revoke = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await db
    .rpc('revoke_api_key', { api_key_id: id })

  if (err) throw err

  await emitLog(ctx, 'api_key.revoked', 
    { type: 'api_key', id }, 
    { after: { revoked_by: ctx.personId } }
  )

  return { success: data }
}))

// List API key usage logs
export const listUsageLogs = createHandler(async (ctx, body) => {
  const { api_key_id, response_status, success, date_from, date_to, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('api_key_usage_logs')
    .select(`
      *,
      api_key:api_keys(id, name, key_type)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (api_key_id) {
    query = query.eq('api_key_id', api_key_id)
  }
  if (response_status) {
    query = query.eq('response_status', parseInt(response_status.toString()))
  }
  if (success !== undefined) {
    query = query.eq('success', success === 'true')
  }
  if (date_from) {
    query = query.gte('created_at', date_from)
  }
  if (date_to) {
    query = query.lte('created_at', date_to)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Log API key usage
export const logUsage = createHandler(async (ctx, body) => {
  const { api_key_id, request_method, request_path, request_ip, user_agent, response_status, response_size, duration_ms, success, error_message, metadata } = body

  if (!api_key_id) {
    throw new Error('api_key_id is required')
  }

  const { data, error: err } = await db
    .rpc('log_api_key_usage', {
      api_key_id,
      request_method,
      request_path,
      request_ip,
      user_agent,
      response_status,
      response_size,
      duration_ms,
      success: success !== false,
      error_message,
      metadata: metadata || {}
    })

  if (err) throw err

  return { usage_log_id: data }
})

// Get API key statistics
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_api_key_statistics', {
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Generate API key (helper)
export const generate = createHandler(async (ctx, body) => {
  const { key_type, key_prefix } = body

  const { data, error: err } = await db
    .rpc('generate_api_key', {
      key_type: key_type || 'private',
      key_prefix: key_prefix || 'sk_'
    })

  if (err) throw err

  return { api_key: data }
})

// Deactivate expired keys
export const deactivateExpired = requireAuth(createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('deactivate_expired_api_keys')

  if (err) throw err

  await emitLog(ctx, 'api_keys.deactivated_expired', 
    { type: 'system', id: 'batch_deactivate' }, 
    { after: { deactivated_count: data } }
  )

  return { deactivated_count: data }
}))

// Cleanup usage logs
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const { data, error: err } = await db
    .rpc('cleanup_api_key_usage_logs', {
      days_to_keep: days_to_keep || 30
    })

  if (err) throw err

  await emitLog(ctx, 'api_key_usage_logs.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 30, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Get usage analytics
export const getUsageAnalytics = createHandler(async (ctx, body) => {
  const { date_from, date_to, group_by } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('api_key_usage_logs')
    .select(`
      created_at::date as date,
      api_key_id,
      response_status,
      success,
      count(*) as requests,
      avg(duration_ms) as avg_duration,
      sum(response_size) as total_response_size
    `)
    .eq('account_id', ctx.accountId)

  if (date_from) {
    query = query.gte('created_at', date_from)
  }
  if (date_to) {
    query = query.lte('created_at', date_to)
  }

  // Group by specified field
  if (group_by === 'date') {
    query = query.group('created_at::date')
  } else if (group_by === 'api_key') {
    query = query.group('api_key_id')
  } else if (group_by === 'status') {
    query = query.group('response_status')
  } else {
    query = query.group('created_at::date, api_key_id')
  }

  query = query.order('date DESC, requests DESC')

  const { data, error: err } = await query

  if (err) throw err

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'validate':
      if (method === 'POST') {
        return await validate(ctx, body)
      }
      break
    case 'rotate':
      if (method === 'POST') {
        return await rotate(ctx, body)
      }
      break
    case 'revoke':
      if (method === 'POST') {
        return await revoke(ctx, body)
      }
      break
    case 'usage-logs':
      if (method === 'GET') {
        return await listUsageLogs(ctx, body)
      } else if (method === 'POST') {
        return await logUsage(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'generate':
      if (method === 'POST') {
        return await generate(ctx, body)
      }
      break
    case 'deactivate-expired':
      if (method === 'POST') {
        return await deactivateExpired(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
      }
      break
    case 'analytics':
      if (method === 'GET') {
        return await getUsageAnalytics(ctx, body)
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
      }
  }

  throw new Error('Invalid action or method')
})
