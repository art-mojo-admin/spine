import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List timers
export const list = createHandler(async (ctx, body) => {
  const { app_id, schedule_type, action_type, is_active } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('timers')
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
  if (schedule_type) {
    query = query.eq('schedule_type', schedule_type)
  }
  if (action_type) {
    query = query.eq('action_type', action_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }

  const { data, error: err } = await query

  if (err) throw err

  return data
})

// Get single timer
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data, error: err } = await db
    .from('timers')
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

// Create timer
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, schedule_type, schedule_config, action_type, action_config, metadata } = body

  if (!name || !schedule_type || !schedule_config || !action_type) {
    throw new Error('name, schedule_type, schedule_config, and action_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_timer', {
      app_id,
      name,
      description,
      schedule_type,
      schedule_config,
      action_type,
      action_config: action_config || {},
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'timer.created', 
    { type: 'timer', id: data }, 
    { after: { name, schedule_type, action_type } }
  )

  return { timer_id: data }
}))

// Update timer
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, schedule_config, action_config, metadata } = body

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_timer', {
      timer_id: id,
      name,
      description,
      schedule_config,
      action_config,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'timer.updated', 
    { type: 'timer', id }, 
    { after: { name, description } }
  )

  return { success: data }
}))

// Toggle timer (activate/deactivate)
export const toggle = requireAuth(createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Timer ID and is_active are required')
  }

  const { data, error: err } = await db
    .rpc('toggle_timer', {
      timer_id: id,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'timer.toggled', 
    { type: 'timer', id }, 
    { after: { is_active } }
  )

  return { success: data }
}))

// Get due timers
export const getDue = createHandler(async (ctx, body) => {
  const { limit = 100 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_due_timers', {
      account_id: ctx.accountId,
      limit: parseInt(limit.toString())
    })

  if (err) throw err

  return data
})

// Execute timer manually
export const execute = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data, error: err } = await db
    .rpc('execute_timer', { timer_id: id })

  if (err) throw err

  await emitLog(ctx, 'timer.executed', 
    { type: 'timer_execution', id: data[0]?.execution_id }, 
    { after: { timer_id: id, status: data[0]?.status } }
  )

  return data
}))

// Calculate next run time
export const calculateNextRun = createHandler(async (ctx, body) => {
  const { schedule_type, schedule_config } = body

  if (!schedule_type || !schedule_config) {
    throw new Error('schedule_type and schedule_config are required')
  }

  const { data, error: err } = await db
    .rpc('calculate_next_run', {
      schedule_type,
      schedule_config
    })

  if (err) throw err

  return { next_run_at: data }
})

// Get timer statistics
export const getStats = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_timer_statistics', {
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Run due timers
export const runDue = requireAuth(createHandler(async (ctx, body) => {
  const { limit = 100 } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('run_due_timers', {
      account_id: ctx.accountId,
      limit
    })

  if (err) throw err

  await emitLog(ctx, 'timers.run_due', 
    { type: 'system', id: 'timer_batch' }, 
    { after: { timer_count: data.length, limit } }
  )

  return data
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'due':
      if (method === 'GET') {
        return await getDue(ctx, body)
      }
      break
    case 'execute':
      if (method === 'POST') {
        return await execute(ctx, body)
      }
      break
    case 'calculate':
      if (method === 'POST') {
        return await calculateNextRun(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'run-due':
      if (method === 'POST') {
        return await runDue(ctx, body)
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
