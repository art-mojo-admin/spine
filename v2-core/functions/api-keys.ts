import { createHandler } from './_shared/middleware'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// List API keys
export const list = createHandler(async (ctx, _body) => {
  const { integration_id, key_type, is_active, expires_before, expires_after, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('api_keys')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      created_by_person:people(id, full_name, email)
    `)
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

  const sanitized = []
  for (const key of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, key, 'api_key'))
  }

  return sanitized
})

// Get single API key
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('api_keys')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'api_key')
})

// Create API key (uses valid DB RPC)
export const create = createHandler(async (ctx, body) => {
  const { integration_id, name, key_type, key_prefix, permissions, rate_limit, expires_at, metadata } = body

  if (!name) {
    throw new Error('name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .rpc('create_api_key', {
      integration_id,
      name,
      key_type: key_type || 'private',
      key_prefix: key_prefix || 'sk_',
      permissions: permissions || {},
      rate_limit: rate_limit || 1000,
      expires_at,
      metadata: metadata || {},
      created_by: ctx.principal?.id,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'api_key.created', 
    { type: 'api_key', id: data[0]?.api_key_id }, 
    { after: { name, key_type, rate_limit } }
  )

  return data
})

// Validate API key (uses valid DB RPC)
export const validate = createHandler(async (ctx, body) => {
  const { key_value, required_permissions } = body

  if (!key_value) {
    throw new Error('key_value is required')
  }

  const { data, error: err } = await ctx.db
    .rpc('validate_api_key', {
      key_value,
      required_permissions: required_permissions || {}
    })

  if (err) throw err

  return data
})

// Revoke API key (deactivate via direct query)
export const revoke = createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('api_keys')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'api_key.revoked', 
    { type: 'api_key', id }, 
    { after: { revoked_by: ctx.principal?.id } }
  )

  return data
})

// List API key usage logs
export const listUsageLogs = createHandler(async (ctx, _body) => {
  const { api_key_id, response_status, success, date_from, date_to, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('api_key_usage_logs')
    .select(`
      *,
      api_key:api_keys(id, name, key_type)
    `)
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
    case 'revoke':
      if (method === 'POST') {
        return await revoke(ctx, body)
      }
      break
    case 'usage-logs':
      if (method === 'GET') {
        return await listUsageLogs(ctx, body)
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
