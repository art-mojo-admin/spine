import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Get AI model configurations
export const getModelConfigs = createHandler(async (ctx, body) => {
  const { model_type, provider, include_unavailable } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('get_ai_model_configs', {
      model_type: model_type || null,
      provider: provider || null,
      include_unavailable: include_unavailable === 'true'
    })

  if (err) throw err

  return data
})

// Get default AI model
export const getDefaultModel = createHandler(async (ctx, body) => {
  const { model_type } = ctx.query || {}

  if (!model_type) {
    throw new Error('model_type is required')
  }

  const { data, error: err } = await db
    .rpc('v2_get_default_ai_model', { model_type })

  if (err) throw err

  return data
})

// Get AI layer statistics
export const getLayerStats = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('v2_get_ai_layer_statistics', {
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Toggle account AI components
export const toggleComponents = requireAuth(createHandler(async (ctx, body) => {
  const { is_active } = body

  if (typeof is_active !== 'boolean') {
    throw new Error('is_active boolean is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('v2_toggle_account_ai_components', {
      account_id: ctx.accountId,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'ai_components.toggled', 
    { type: 'system', id: 'account_toggle' }, 
    { after: { is_active } }
  )

  return data
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'model-configs':
      if (method === 'GET') {
        return await getModelConfigs(ctx, body)
      }
      break
    case 'default-model':
      if (method === 'GET') {
        return await getDefaultModel(ctx, body)
      }
      break
    case 'layer-stats':
      if (method === 'GET') {
        return await getLayerStats(ctx, body)
      }
      break
    case 'toggle-components':
      if (method === 'POST') {
        return await toggleComponents(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        return await getLayerStats(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
