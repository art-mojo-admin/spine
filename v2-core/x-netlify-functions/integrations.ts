import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List integrations
export const list = createHandler(async (ctx, body) => {
  const { integration_type, provider, is_active, is_configured, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('integrations')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('name')

  if (integration_type) {
    query = query.eq('integration_type', integration_type)
  }
  if (provider) {
    query = query.eq('provider', provider)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }
  if (is_configured !== undefined) {
    query = query.eq('is_configured', is_configured === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Get single integration
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .from('integrations')
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

// Create integration
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, integration_type, provider, version, config, credentials, metadata } = body

  if (!name || !integration_type || !provider) {
    throw new Error('name, integration_type, and provider are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_integration', {
      app_id,
      name,
      description,
      integration_type,
      provider,
      version,
      config: config || {},
      credentials: credentials || {},
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'integration.created', 
    { type: 'integration', id: data }, 
    { after: { name, integration_type, provider } }
  )

  return { integration_id: data }
}))

// Update integration
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, config, credentials, metadata, is_active } = body

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_integration', {
      integration_id: id,
      name,
      description,
      config,
      credentials,
      metadata,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'integration.updated', 
    { type: 'integration', id }, 
    { after: { name, description, is_active } }
  )

  return { success: data }
}))

// Test integration connection
export const test = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('test_integration_connection', { integration_id: id })

  if (err) throw err

  await emitLog(ctx, 'integration.tested', 
    { type: 'integration', id }, 
    { after: { success: data[0]?.success } }
  )

  return data
}))

// Sync integration
export const sync = requireAuth(createHandler(async (ctx, body) => {
  const { id, sync_type, connection_id } = body

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('sync_integration', {
      integration_id: id,
      sync_type: sync_type || 'manual',
      connection_id
    })

  if (err) throw err

  await emitLog(ctx, 'integration.synced', 
    { type: 'integration', id }, 
    { after: { sync_type: sync_type || 'manual', sync_id: data[0]?.sync_id } }
  )

  return data
}))

// Get integration statistics
export const getStats = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_integration_statistics', {
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// List integration connections
export const listConnections = createHandler(async (ctx, body) => {
  const { integration_id, connection_status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('integration_connections')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (integration_id) {
    query = query.eq('integration_id', integration_id)
  }
  if (connection_status) {
    query = query.eq('connection_status', connection_status)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Create integration connection
export const createConnection = requireAuth(createHandler(async (ctx, body) => {
  const { integration_id, external_id, external_name, external_type, external_data, metadata } = body

  if (!integration_id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('create_integration_connection', {
      integration_id,
      external_id,
      external_name,
      external_type,
      external_data: external_data || {},
      metadata: metadata || {}
    })

  if (err) throw err

  await emitLog(ctx, 'integration_connection.created', 
    { type: 'integration_connection', id: data }, 
    { after: { integration_id, external_name } }
  )

  return { connection_id: data }
}))

// List sync logs
export const listSyncLogs = createHandler(async (ctx, body) => {
  const { integration_id, connection_id, sync_type, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('integration_sync_logs')
    .select(`
      *,
      integration:integrations(id, name, provider),
      connection:integration_connections(id, external_name, external_type)
    `)
    .eq('account_id', ctx.accountId)
    .order('started_at', { ascending: false })

  if (integration_id) {
    query = query.eq('integration_id', integration_id)
  }
  if (connection_id) {
    query = query.eq('connection_id', connection_id)
  }
  if (sync_type) {
    query = query.eq('sync_type', sync_type)
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

// Sync all integrations
export const syncAll = requireAuth(createHandler(async (ctx, body) => {
  const { integration_type } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('sync_all_integrations', {
      account_id: ctx.accountId,
      integration_type: integration_type || null
    })

  if (err) throw err

  await emitLog(ctx, 'integrations.synced_all', 
    { type: 'system', id: 'batch_sync' }, 
    { after: { integration_type, sync_count: data.length } }
  )

  return data
}))

// Validate integration config
export const validateConfig = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await db
    .rpc('validate_integration_config', { integration_id: id })

  if (err) throw err

  return data
})

// Cleanup old data
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const results = {}

  // Cleanup sync logs
  const { data: syncCleanup, error: syncErr } = await db
    .rpc('cleanup_integration_sync_logs', {
      days_to_keep: days_to_keep || 30
    })

  if (!syncErr) {
    results.sync_logs = syncCleanup
  }

  await emitLog(ctx, 'integrations.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 30, results } }
  )

  return results
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'
  const { action } = ctx.query || {}

  switch (method) {
    case 'GET':
      if (action === 'stats') {
        return await getStats(ctx, body)
      } else if (action === 'connections') {
        return await listConnections(ctx, body)
      } else if (action === 'sync-logs') {
        return await listSyncLogs(ctx, body)
      } else if (action === 'validate') {
        return await validateConfig(ctx, body)
      } else if (ctx.query?.id) {
        return await get(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      if (action === 'test') {
        return await test(ctx, body)
      } else if (action === 'sync') {
        return await sync(ctx, body)
      } else if (action === 'connections') {
        return await createConnection(ctx, body)
      } else if (action === 'sync-all') {
        return await syncAll(ctx, body)
      } else if (action === 'cleanup') {
        return await cleanup(ctx, body)
      } else {
        return await create(ctx, body)
      }
    case 'PATCH':
      return await update(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
