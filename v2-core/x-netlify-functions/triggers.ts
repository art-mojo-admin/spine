import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List triggers by event type
export const listByEvent = createHandler(async (ctx, body) => {
  const { event_type, app_id, include_inactive } = ctx.query || {}

  if (!event_type) {
    throw new Error('event_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_triggers_by_event', {
      event_type,
      account_id: ctx.accountId,
      app_id: app_id || null,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// List all triggers
export const list = createHandler(async (ctx, body) => {
  const { app_id, event_type, include_inactive } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('triggers')
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
  if (event_type) {
    query = query.eq('event_type', event_type)
  }
  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query

  if (err) throw err

  return data
})

// Get single trigger
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  const { data, error: err } = await db
    .from('triggers')
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

// Create trigger
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, event_type, conditions, actions, metadata } = body

  if (!name || !event_type || !actions) {
    throw new Error('name, event_type, and actions are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_trigger', {
      app_id,
      name,
      description,
      event_type,
      conditions: conditions || {},
      actions,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'trigger.created', 
    { type: 'trigger', id: data }, 
    { after: { name, event_type } }
  )

  return { trigger_id: data }
}))

// Update trigger
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, conditions, actions, metadata } = body

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_trigger', {
      trigger_id: id,
      name,
      description,
      conditions,
      actions,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'trigger.updated', 
    { type: 'trigger', id }, 
    { after: { name, description } }
  )

  return { success: data }
}))

// Toggle trigger (activate/deactivate)
export const toggle = requireAuth(createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Trigger ID and is_active are required')
  }

  const { data, error: err } = await db
    .rpc('toggle_trigger', {
      trigger_id: id,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'trigger.toggled', 
    { type: 'trigger', id }, 
    { after: { is_active } }
  )

  return { success: data }
}))

// Test trigger conditions
export const test = createHandler(async (ctx, body) => {
  const { id, event_data } = body

  if (!id || !event_data) {
    throw new Error('Trigger ID and event_data are required')
  }

  const { data, error: err } = await db
    .rpc('evaluate_trigger_conditions', {
      trigger_id: id,
      event_data
    })

  if (err) throw err

  return { conditions_met: data }
})

// Preview trigger actions
export const preview = createHandler(async (ctx, body) => {
  const { id, event_data } = body

  if (!id || !event_data) {
    throw new Error('Trigger ID and event_data are required')
  }

  const { data, error: err } = await db
    .rpc('execute_trigger_actions', {
      trigger_id: id,
      event_data
    })

  if (err) throw err

  return data
})

// Get trigger execution history
export const getExecutions = createHandler(async (ctx, body) => {
  const { trigger_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!trigger_id) {
    throw new Error('Trigger ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_trigger_executions', {
      trigger_id,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Process event triggers
export const processEvent = requireAuth(createHandler(async (ctx, body) => {
  const { event_type, event_data, app_id } = body

  if (!event_type || !event_data) {
    throw new Error('event_type and event_data are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('process_event_triggers', {
      event_type,
      event_data,
      account_id: ctx.accountId,
      app_id: app_id || null
    })

  if (err) throw err

  await emitLog(ctx, 'triggers.processed', 
    { type: 'system', id: 'event_processing' }, 
    { after: { event_type, trigger_count: data.length } }
  )

  return data
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'by-event':
      if (method === 'GET') {
        return await listByEvent(ctx, body)
      }
      break
    case 'test':
      if (method === 'POST') {
        return await test(ctx, body)
      }
      break
    case 'preview':
      if (method === 'POST') {
        return await preview(ctx, body)
      }
      break
    case 'executions':
      if (method === 'GET') {
        return await getExecutions(ctx, body)
      }
      break
    case 'process':
      if (method === 'POST') {
        return await processEvent(ctx, body)
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
