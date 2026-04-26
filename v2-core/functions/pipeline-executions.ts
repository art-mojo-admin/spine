import { createHandler, json, error, parseBody } from './_shared/middleware'
import { emitLog } from './_shared/audit'

// v2.pipeline_executions columns: id, pipeline_id, status, trigger_data, result,
//   error_message, started_at, completed_at, duration_ms, created_by, account_id, created_at
// FKs: pipeline_id → pipelines, created_by → people, account_id → accounts

const SELECT_WITH_JOINS = `
  *,
  pipeline:pipelines(id, name, trigger_type),
  triggered_by_person:people!pipeline_executions_created_by_fkey(id, full_name, email)
`

// ── List executions ──────────────────────────────────────
export const list = createHandler(async (ctx, body) => {
  const { pipeline_id, status, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('pipeline_executions')
    .select(SELECT_WITH_JOINS)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (pipeline_id) query = query.eq('pipeline_id', pipeline_id)
  if (status) query = query.eq('status', status)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// ── Get single execution ─────────────────────────────────
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .select(SELECT_WITH_JOINS)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// ── Create execution ─────────────────────────────────────
export const create = createHandler(async (ctx, body) => {
  const { pipeline_id, trigger_data } = body

  if (!pipeline_id) {
    throw new Error('Pipeline ID is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .insert({
      pipeline_id,
      status: 'pending',
      trigger_data: trigger_data || {},
      created_by: ctx.principal?.id || null,
      account_id: ctx.accountId,
    })
    .select('id')
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.created',
    { type: 'pipeline_execution', id: data?.id },
    { after: { pipeline_id } }
  )

  return { execution_id: data?.id }
})

// ── Start execution ──────────────────────────────────────
export const start = createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.started',
    { type: 'pipeline_execution', id },
    { after: { status: 'running' } }
  )

  return { success: true }
})

// ── Complete execution ───────────────────────────────────
export const complete = createHandler(async (ctx, body) => {
  const { id, output_data, error_message } = body

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const now = new Date().toISOString()
  const finalStatus = error_message ? 'failed' : 'completed'

  // Fetch started_at to compute duration
  const { data: existing } = await ctx.db
    .from('pipeline_executions')
    .select('started_at')
    .eq('id', id)
    .single()

  const duration_ms = existing?.started_at
    ? Math.round(Date.now() - new Date(existing.started_at).getTime())
    : null

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .update({
      status: finalStatus,
      result: output_data || {},
      error_message: error_message || null,
      completed_at: now,
      duration_ms,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.completed',
    { type: 'pipeline_execution', id },
    { after: { status: finalStatus, error_message } }
  )

  return { success: true }
})

// ── Cancel execution ─────────────────────────────────────
export const cancel = createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Execution ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline_execution.cancelled',
    { type: 'pipeline_execution', id },
    { after: { status: 'cancelled' } }
  )

  return { success: true }
})

// ── Get running executions ───────────────────────────────
export const getRunning = createHandler(async (ctx, body) => {
  const { pipeline_id } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('pipeline_executions')
    .select(SELECT_WITH_JOINS)
    .eq('account_id', ctx.accountId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })

  if (pipeline_id) query = query.eq('pipeline_id', pipeline_id)

  const { data, error: err } = await query

  if (err) throw err

  return data
})

// ── Get execution statistics ─────────────────────────────
export const getStats = createHandler(async (ctx, body) => {
  const { pipeline_id, date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('pipeline_executions')
    .select('id, status')
    .eq('account_id', ctx.accountId)

  if (pipeline_id) query = query.eq('pipeline_id', pipeline_id)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to)

  const { data, error: err } = await query

  if (err) throw err

  const rows = data || []
  return {
    total: rows.length,
    completed: rows.filter((r: any) => r.status === 'completed').length,
    failed: rows.filter((r: any) => r.status === 'failed').length,
    running: rows.filter((r: any) => r.status === 'running').length,
  }
})

// ── Cleanup old executions (admin only) ──────────────────
export const cleanup = createHandler(async (ctx, body) => {
  const { days_to_keep = 30, status_filter } = body

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - parseInt(days_to_keep.toString()))

  let query = ctx.db
    .from('pipeline_executions')
    .delete()
    .lt('created_at', cutoff.toISOString())

  if (status_filter) query = query.eq('status', status_filter)

  const { data, error: err } = await query.select('id')

  if (err) throw err

  await emitLog(ctx, 'pipeline_executions.cleaned',
    { type: 'system', id: 'cleanup' },
    { after: { deleted_count: (data || []).length } }
  )

  return { deleted_count: (data || []).length }
})

// ── Main handler ─────────────────────────────────────────
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'list':
      if (method === 'GET') return await list(ctx, body)
      break
    case 'running':
      if (method === 'GET') return await getRunning(ctx, body)
      break
    case 'stats':
      if (method === 'GET') return await getStats(ctx, body)
      break
    case 'cleanup':
      if (method === 'POST') return await cleanup(ctx, body)
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
        if (ctx.query?.action === 'start') return await start(ctx, body)
        else if (ctx.query?.action === 'complete') return await complete(ctx, body)
        else if (ctx.query?.action === 'cancel') return await cancel(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
