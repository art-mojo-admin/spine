import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List OAuth connections
export const listConnections = createHandler(async (ctx, body) => {
  const { integration_id, user_id, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('oauth_connections')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      user:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (integration_id) {
    query = query.eq('integration_id', integration_id)
  }
  if (user_id) {
    query = query.eq('user_id', user_id)
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

// Get single OAuth connection
export const getConnection = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Connection ID is required')
  }

  const { data, error: err } = await db
    .rpc('v2_get_oauth_connection', { connection_id: id })

  if (err) throw err

  return data
})

// Create OAuth connection
export const createConnection = requireAuth(createHandler(async (ctx, body) => {
  const { integration_id, user_id, client_id, client_secret, access_token, refresh_token, token_type, expires_at, scope, metadata } = body

  if (!integration_id || !client_id || !access_token) {
    throw new Error('integration_id, client_id, and access_token are required')
  }

  const { data, error: err } = await db
    .rpc('create_oauth_connection', {
      integration_id,
      user_id,
      client_id,
      client_secret,
      access_token,
      refresh_token,
      token_type: token_type || 'Bearer',
      expires_at,
      scope,
      metadata: metadata || {}
    })

  if (err) throw err

  await emitLog(ctx, 'oauth_connection.created', 
    { type: 'oauth_connection', id: data }, 
    { after: { integration_id, user_id } }
  )

  return { connection_id: data }
}))

// Refresh OAuth token
export const refreshToken = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Connection ID is required')
  }

  const { data, error: err } = await db
    .rpc('refresh_oauth_token', { connection_id: id })

  if (err) throw err

  await emitLog(ctx, 'oauth_token.refreshed', 
    { type: 'oauth_connection', id }, 
    { after: { success: data[0]?.success } }
  )

  return data
}))

// Validate OAuth token
export const validateToken = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Connection ID is required')
  }

  const { data, error: err } = await db
    .rpc('validate_oauth_token', { connection_id: id })

  if (err) throw err

  return data
})

// List OAuth scopes
export const listScopes = createHandler(async (ctx, body) => {
  const { integration_id, is_granted, is_required } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('oauth_scopes')
    .select(`
      *,
      integration:integrations(id, name, provider),
      granted_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('is_required DESC, scope_name')

  if (integration_id) {
    query = query.eq('integration_id', integration_id)
  }
  if (is_granted !== undefined) {
    query = query.eq('is_granted', is_granted === 'true')
  }
  if (is_required !== undefined) {
    query = query.eq('is_required', is_required === 'true')
  }

  const { data, error: err } = await query

  if (err) throw err

  return data
})

// Create OAuth scope
export const createScope = requireAuth(createHandler(async (ctx, body) => {
  const { integration_id, scope_name, scope_description, is_required } = body

  if (!integration_id || !scope_name) {
    throw new Error('integration_id and scope_name are required')
  }

  const { data, error: err } = await db
    .rpc('create_oauth_scope', {
      integration_id,
      scope_name,
      scope_description,
      is_required: is_required || false
    })

  if (err) throw err

  await emitLog(ctx, 'oauth_scope.created', 
    { type: 'oauth_scope', id: data }, 
    { after: { integration_id, scope_name } }
  )

  return { scope_id: data }
}))

// Grant OAuth scope
export const grantScope = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Scope ID is required')
  }

  const { data, error: err } = await db
    .rpc('grant_oauth_scope', {
      scope_id: id,
      granted_by: ctx.personId
    })

  if (err) throw err

  await emitLog(ctx, 'oauth_scope.granted', 
    { type: 'oauth_scope', id }, 
    { after: { granted_by: ctx.personId } }
  )

  return { success: data }
}))

// Revoke OAuth scope
export const revokeScope = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Scope ID is required')
  }

  const { data, error: err } = await db
    .rpc('revoke_oauth_scope', { scope_id: id })

  if (err) throw err

  await emitLog(ctx, 'oauth_scope.revoked', 
    { type: 'oauth_scope', id }, 
    { after: { revoked_by: ctx.personId } }
  )

  return { success: data }
}))

// Get OAuth scopes for integration
export const getIntegrationScopes = createHandler(async (ctx, body) => {
  const { integration_id } = ctx.query || {}

  if (!integration_id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_oauth_scopes', { integration_id })

  if (err) throw err

  return data
})

// Refresh all expired tokens
export const refreshExpiredTokens = requireAuth(createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // Get connections that need refresh
  const { data: connections, error: connErr } = await db
    .from('oauth_connections')
    .select(`
      id,
      integration_id,
      expires_at,
      refresh_token
    `)
    .eq('account_id', ctx.accountId)
    .eq('is_active', true)
    .not('refresh_token', 'is', null)
    .lte('expires_at', new Date(Date.now() + 5 * 60 * 1000).toISOString()) // Expires in next 5 minutes

  if (connErr) throw connErr

  const results = []

  for (const connection of connections || []) {
    try {
      const { data, error } = await db
        .rpc('refresh_oauth_token', { connection_id: connection.id })

      if (!error) {
        results.push({
          connection_id: connection.id,
          success: data[0]?.success,
          new_expires_at: data[0]?.new_expires_at,
          error: data[0]?.error_message
        })
      }
    } catch (err) {
      results.push({
        connection_id: connection.id,
        success: false,
        error: err.message
      })
    }
  }

  await emitLog(ctx, 'oauth_tokens.refreshed_batch', 
    { type: 'system', id: 'batch_refresh' }, 
    { after: { refreshed_count: results.length } }
  )

  return results
}))

// Cleanup expired connections
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_expired } = body

  const { data, error: err } = await db
    .rpc('cleanup_expired_oauth_connections', {
      days_expired: days_expired || 30
    })

  if (err) throw err

  await emitLog(ctx, 'oauth_connections.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_expired: days_expired || 30, deactivated_count: data } }
  )

  return { deactivated_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'connections':
      if (method === 'GET') {
        return await listConnections(ctx, body)
      }
      break
    case 'scopes':
      if (method === 'GET') {
        return await listScopes(ctx, body)
      } else if (method === 'POST') {
        return await createScope(ctx, body)
      }
      break
    case 'grant-scope':
      if (method === 'POST') {
        return await grantScope(ctx, body)
      }
      break
    case 'revoke-scope':
      if (method === 'POST') {
        return await revokeScope(ctx, body)
      }
      break
    case 'integration-scopes':
      if (method === 'GET') {
        return await getIntegrationScopes(ctx, body)
      }
      break
    case 'refresh-token':
      if (method === 'POST') {
        return await refreshToken(ctx, body)
      }
      break
    case 'validate-token':
      if (method === 'GET') {
        return await validateToken(ctx, body)
      }
      break
    case 'refresh-expired':
      if (method === 'POST') {
        return await refreshExpiredTokens(ctx, body)
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
          return await getConnection(ctx, body)
        } else {
          return await listConnections(ctx, body)
        }
      } else if (method === 'POST') {
        return await createConnection(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
