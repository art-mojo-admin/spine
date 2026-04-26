import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Get app's integrations
export const getAppIntegrations = createHandler(async (ctx, body) => {
  const { app_id } = ctx.query || {}

  if (!app_id) {
    throw new Error('App ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_app_integrations', {
      app_id
    })

  if (err) throw err

  return data
})

// Get integration's apps
export const getIntegrationApps = createHandler(async (ctx, body) => {
  const { integration_instance_id } = ctx.query || {}

  if (!integration_instance_id) {
    throw new Error('Integration instance ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_integration_apps', {
      integration_instance_id
    })

  if (err) throw err

  return data
})

// Add integration to app
export const add = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, integration_instance_id, config } = body

  if (!app_id || !integration_instance_id) {
    throw new Error('app_id and integration_instance_id are required')
  }

  const { data, error: err } = await db
    .rpc('add_integration_to_app', {
      app_id,
      integration_instance_id,
      config: config || {}
    })

  if (err) throw err

  await emitLog(ctx, 'app_integration.added', 
    { type: 'app_integration', id: data }, 
    { after: { app_id, integration_instance_id, config } }
  )

  return { link_id: data }
}))

// Remove integration from app
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, integration_instance_id } = body

  if (!app_id || !integration_instance_id) {
    throw new Error('app_id and integration_instance_id are required')
  }

  const { data, error: err } = await db
    .rpc('remove_integration_from_app', {
      app_id,
      integration_instance_id
    })

  if (err) throw err

  await emitLog(ctx, 'app_integration.removed', 
    { type: 'app_integration', id: `${app_id}-${integration_instance_id}` }, 
    { before: { app_id, integration_instance_id } }
  )

  return { success: data }
}))

// Get link details
export const getLink = createHandler(async (ctx, body) => {
  const { app_id, integration_instance_id } = ctx.query || {}

  if (!app_id || !integration_instance_id) {
    throw new Error('app_id and integration_instance_id are required')
  }

  const { data, error: err } = await db
    .from('apps_integrations')
    .select(`
      *,
      app:apps(id, slug, name, icon, color),
      integration_instance:integration_instances(id, slug, name, config),
      integration:integrations(id, slug, name, description)
    `)
    .eq('app_id', app_id)
    .eq('integration_instance_id', integration_instance_id)
    .single()

  if (err) throw err

  return data
})

// Update link
export const updateLink = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, integration_instance_id, config } = body

  if (!app_id || !integration_instance_id) {
    throw new Error('app_id and integration_instance_id are required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('apps_integrations')
    .select('*')
    .eq('app_id', app_id)
    .eq('integration_instance_id', integration_instance_id)
    .single()

  if (!current) {
    throw new Error('App-integration link not found')
  }

  const updates: any = {}
  if (config !== undefined) updates.config = config
  updates.updated_at = new Date().toISOString()

  const { data, error: err } = await db
    .from('apps_integrations')
    .update(updates)
    .eq('app_id', app_id)
    .eq('integration_instance_id', integration_instance_id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app_integration.updated', 
    { type: 'app_integration', id: `${app_id}-${integration_instance_id}` }, 
    { before: current, after: data }
  )

  return data
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'app-integrations':
      if (method === 'GET') {
        return await getAppIntegrations(ctx, body)
      }
      break
    case 'integration-apps':
      if (method === 'GET') {
        return await getIntegrationApps(ctx, body)
      }
      break
    case 'add':
      if (method === 'POST') {
        return await add(ctx, body)
      }
      break
    case 'remove':
      if (method === 'POST') {
        return await remove(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.app_id && ctx.query?.integration_instance_id) {
        return await getLink(ctx, body)
      } else if (method === 'PATCH') {
        return await updateLink(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
