import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List AI orchestrators
export const list = createHandler(async (ctx, body) => {
  const { orchestrator_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('ai_orchestrator')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('name')

  if (orchestrator_type) {
    query = query.eq('orchestrator_type', orchestrator_type)
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

// Get single AI orchestrator
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Orchestrator ID is required')
  }

  const { data, error: err } = await db
    .from('ai_orchestrator')
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

// Create AI orchestrator
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, orchestrator_type, config, agent_mappings, prompt_mappings, routing_rules, processing_pipeline, metadata } = body

  if (!name || !orchestrator_type) {
    throw new Error('name and orchestrator_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_ai_orchestrator', {
      app_id,
      name,
      description,
      orchestrator_type,
      config: config || {},
      agent_mappings: agent_mappings || [],
      prompt_mappings: prompt_mappings || [],
      routing_rules: routing_rules || [],
      processing_pipeline: processing_pipeline || [],
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'ai_orchestrator.created', 
    { type: 'ai_orchestrator', id: data }, 
    { after: { name, orchestrator_type } }
  )

  return { orchestrator_id: data }
}))

// Update AI orchestrator
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, config, agent_mappings, prompt_mappings, routing_rules, processing_pipeline, metadata, is_active } = body

  if (!id) {
    throw new Error('Orchestrator ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_ai_orchestrator', {
      orchestrator_id: id,
      name,
      description,
      config,
      agent_mappings,
      prompt_mappings,
      routing_rules,
      processing_pipeline,
      metadata,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'ai_orchestrator.updated', 
    { type: 'ai_orchestrator', id }, 
    { after: { name, is_active } }
  )

  return { success: data }
}))

// Execute orchestrator
export const execute = requireAuth(createHandler(async (ctx, body) => {
  const { orchestrator_id, input_data, context_data } = body

  if (!orchestrator_id) {
    throw new Error('orchestrator_id is required')
  }

  const { data, error: err } = await db
    .rpc('execute_orchestrator', {
      orchestrator_id,
      input_data: input_data || {},
      context_data: context_data || {}
    })

  if (err) throw err

  await emitLog(ctx, 'ai_orchestrator.executed', 
    { type: 'ai_orchestrator_execution', id: data[0]?.execution_id }, 
    { after: { orchestrator_id, status: data[0]?.status } }
  )

  return data[0]
}))

// Get orchestrator executions
export const getExecutions = createHandler(async (ctx, body) => {
  const { orchestrator_id, status, limit, offset } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('get_orchestrator_executions', {
      orchestrator_id: orchestrator_id || null,
      status: status || null,
      limit: limit ? parseInt(limit.toString()) : 50,
      offset: offset ? parseInt(offset.toString()) : 0
    })

  if (err) throw err

  return data
})

// Get orchestrator statistics
export const getStats = createHandler(async (ctx, body) => {
  const { orchestrator_id, date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_orchestrator_statistics', {
      account_id: ctx.accountId,
      orchestrator_id: orchestrator_id || null,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Route message to orchestrator
export const routeMessage = createHandler(async (ctx, body) => {
  const { message_data, context_data } = body

  if (!message_data) {
    throw new Error('message_data is required')
  }

  const { data, error: err } = await db
    .rpc('route_message_to_orchestrator', {
      message_data,
      context_data: context_data || {}
    })

  if (err) throw err

  return data
})

// Get orchestrator health metrics
export const getHealthMetrics = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_orchestrator_health_metrics', {
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Create orchestrator from template
export const createFromTemplate = requireAuth(createHandler(async (ctx, body) => {
  const { template_name, app_id, name, overrides } = body

  if (!template_name) {
    throw new Error('template_name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('v2_create_ai_orchestrator_from_template', {
      template_name,
      app_id,
      name,
      overrides: overrides || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'ai_orchestrator.created_from_template', 
    { type: 'ai_orchestrator', id: data }, 
    { after: { template_name, name } }
  )

  return { orchestrator_id: data }
}))

// Cleanup old executions
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const { data, error: err } = await db
    .rpc('cleanup_orchestrator_executions', {
      days_to_keep: days_to_keep || 30
    })

  if (err) throw err

  await emitLog(ctx, 'ai_orchestrator_executions.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 30, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'execute':
      if (method === 'POST') {
        return await execute(ctx, body)
      }
      break
    case 'executions':
      if (method === 'GET') {
        return await getExecutions(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'route-message':
      if (method === 'POST') {
        return await routeMessage(ctx, body)
      }
      break
    case 'health':
      if (method === 'GET') {
        return await getHealthMetrics(ctx, body)
      }
      break
    case 'from-template':
      if (method === 'POST') {
        return await createFromTemplate(ctx, body)
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
        return await update(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
