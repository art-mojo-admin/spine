/**
 * @module pipeline-executions
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * Lifecycle management API for the `pipeline_executions` table. Records
 * track individual pipeline runs: status progression (pending → running →
 * completed/failed/cancelled), timing, trigger data, and result payloads.
 *
 * **Routed by:** `GET/POST/PATCH /.netlify/functions/pipeline-executions`
 *
 * **Actions:**
 * | method | ?action  | handler    |
 * |--------|----------|------------|
 * | GET    | list     | list       |
 * | GET    | running  | getRunning |
 * | GET    | stats    | getStats   |
 * | POST   | cleanup  | cleanup    |
 * | GET    | ?id      | get        |
 * | GET    | (default)| list       |
 * | POST   | —        | create     |
 * | PATCH  | start    | start      |
 * | PATCH  | complete | complete   |
 * | PATCH  | cancel   | cancel     |
 *
 * **Status FSM:** pending → running → completed | failed | cancelled
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped to account).
 * Account context required.
 *
 * **Column reference:**
 * `id`, `pipeline_id`, `status`, `trigger_data`, `result`, `error_message`,
 * `started_at`, `completed_at`, `duration_ms`, `created_by`, `account_id`, `created_at`
 *
 * @seeAlso pipelines.ts (pipeline_id FK source)
 * @seeAlso pipeline-runner.ts (runPipeline — calls create/start/complete)
 * @seeAlso audit.ts (emitLog for pipeline_execution.* events)
 */

import { createHandler, json, error, parseBody } from './_shared/middleware'
import { emitLog } from './_shared/audit'

const SELECT_WITH_JOINS = `
  *,
  pipeline:pipelines(id, name, trigger_type),
  triggered_by_person:people!pipeline_executions_created_by_fkey(id, full_name, email)
`

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists pipeline executions for the account, newest-first.
 *
 * Query params: `pipeline_id`, `status` ('pending'|'running'|'completed'|
 * 'failed'|'cancelled'), `limit` (default 100), `offset` (default 0)
 *
 * @returns Array of execution records with pipeline + person joins
 * @throws Error('Account context required')
 * @sideEffects DB read: pipeline_executions table
 * @calledBy handler (GET ?action=list or GET default)
 */
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

/**
 * Returns a single pipeline execution by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Execution record with pipeline + person joins
 * @throws Error('Execution ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: pipeline_executions table
 * @calledBy handler (GET ?id)
 */
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

/**
 * Creates a new execution record in `pending` status. Does not run the
 * pipeline — call `start` to transition to `running` and then invoke
 * `pipeline-runner.ts` separately (or let the runner manage state directly).
 *
 * Body: `pipeline_id` (required), `trigger_data` (optional object)
 *
 * @returns `{ execution_id: string }`
 * @throws Error('Pipeline ID is required')
 * @throws Error('Account context required')
 * @sideEffects DB write: pipeline_executions table (INSERT status='pending')
 * @sideEffects audit: emitLog('pipeline_execution.created')
 * @calledBy handler (POST)
 * @calledBy pipeline-runner.ts runPipeline
 */
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

/**
 * Transitions an execution from `pending` to `running` and stamps `started_at`.
 *
 * Body: `id` (required)
 *
 * @returns `{ success: true }`
 * @throws Error('Execution ID is required')
 * @sideEffects DB write: pipeline_executions (UPDATE status='running', started_at)
 * @sideEffects audit: emitLog('pipeline_execution.started')
 * @calledBy handler (PATCH ?action=start)
 * @calledBy pipeline-runner.ts runPipeline
 */
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

/**
 * Transitions a `running` execution to `completed` (or `failed` if
 * `error_message` is provided). Computes `duration_ms` from `started_at`.
 *
 * Body: `id` (required), `output_data` (optional), `error_message` (optional —
 * presence causes status to be set to 'failed')
 *
 * @returns `{ success: true }`
 * @throws Error('Execution ID is required')
 * @sideEffects DB read: pipeline_executions (fetch started_at for duration)
 * @sideEffects DB write: pipeline_executions (UPDATE status, result, completed_at, duration_ms)
 * @sideEffects audit: emitLog('pipeline_execution.completed')
 * @calledBy handler (PATCH ?action=complete)
 * @calledBy pipeline-runner.ts runPipeline
 */
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

/**
 * Cancels an execution mid-flight by setting status to `cancelled`.
 *
 * Body: `id` (required)
 *
 * @returns `{ success: true }`
 * @throws Error('Execution ID is required')
 * @sideEffects DB write: pipeline_executions (UPDATE status='cancelled', completed_at)
 * @sideEffects audit: emitLog('pipeline_execution.cancelled')
 * @calledBy handler (PATCH ?action=cancel)
 */
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

/**
 * Returns all currently `running` executions for the account, ordered
 * by `started_at` desc. Optional filter by `pipeline_id`.
 *
 * Query params: `pipeline_id` (optional)
 *
 * @returns Array of execution records with joins
 * @throws Error('Account context required')
 * @sideEffects DB read: pipeline_executions (WHERE status='running')
 * @calledBy handler (GET ?action=running)
 */
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

/**
 * Returns execution counts by status for the account, optionally filtered
 * by pipeline and date range.
 *
 * Query params: `pipeline_id`, `date_from`, `date_to` (ISO timestamps, optional)
 *
 * @returns `{ total, completed, failed, running }` counts
 * @throws Error('Account context required')
 * @sideEffects DB read: pipeline_executions (id + status only)
 * @calledBy handler (GET ?action=stats)
 */
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

/**
 * Deletes execution records older than `days_to_keep` (default 30).
 * Optionally restrict by `status_filter`. Scoped by RLS.
 *
 * Body: `days_to_keep` (default 30), `status_filter` (optional status string)
 *
 * @returns `{ deleted_count: number }`
 * @sideEffects DB write: pipeline_executions (DELETE WHERE created_at < cutoff)
 * @sideEffects audit: emitLog('pipeline_executions.cleaned')
 * @calledBy handler (POST ?action=cleanup)
 */
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

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. See module dispatch table for full routing.
 * PATCH actions are sub-dispatched via `?action` (start | complete | cancel).
 * @throws Error('Invalid action or method') on unmatched combination
 * @calledBy Netlify function routing
 * @calledBy pipeline-runner.ts (directly invokes create/start/complete)
 */
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
