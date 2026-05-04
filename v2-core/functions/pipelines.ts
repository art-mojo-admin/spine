/**
 * @module pipelines
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `pipelines` table, plus execution history access.
 * Pipelines are named lists of stages that execute sequentially via `runPipeline`
 * in `_shared/pipeline-runner.ts`.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/pipelines`
 *
 * **Actions:**
 * | method | ?action      | handler         |
 * |--------|--------------|-----------------|
 * | GET    | by-trigger   | listByTrigger   |
 * | GET    | executions   | getExecutions   |
 * | POST   | toggle       | toggle          |
 * | GET    | ?id          | get             |
 * | GET    | (default)    | list            |
 * | POST   | —            | create          |
 * | PATCH  | —            | update          |
 * | DELETE | —            | remove (hard)   |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Authenticated
 * principal required for writes.
 *
 * INVARIANT: `remove` is a hard delete (no soft delete for pipelines).
 * INVARIANT: `toggle` is a dedicated POST action — use instead of PATCH for
 *   is_active changes to ensure proper audit logging.
 *
 * @seeAlso pipeline-runner.ts (runPipeline — actual execution engine)
 * @seeAlso trigger-engine.ts (calls runPipeline when triggers fire)
 * @seeAlso audit.ts (emitLog for pipeline.* events)
 */

import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists active pipelines filtered by `trigger_type`.
 *
 * Query params: `trigger_type` (required), `app_id`, `include_inactive` ('true')
 *
 * @returns Sanitized pipeline records ordered by name
 * @throws Error('trigger_type is required')
 * @throws Error('Account context required')
 * @sideEffects DB read: pipelines table
 * @calledBy handler (GET ?action=by-trigger)
 */
export const listByTrigger = createHandler(async (ctx, _body) => {
  const { trigger_type, app_id, include_inactive } = ctx.query || {}

  if (!trigger_type) {
    throw new Error('trigger_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('pipelines')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('trigger_type', trigger_type)

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query.order('name')

  if (err) throw err

  const sanitized = []
  for (const pipeline of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, pipeline, 'pipeline'))
  }

  return sanitized
})

/**
 * Lists all pipelines for the account, with optional filtering.
 *
 * Query params: `app_id`, `include_inactive` ('true')
 *
 * @returns Sanitized pipeline records ordered by name
 * @throws Error('Account context required')
 * @sideEffects DB read: pipelines table (with app + createdBy joins)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/pipelines.test.ts — 'list'
 */
export const list = createHandler(async (ctx, body) => {
  const { app_id, include_inactive } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('pipelines')
    .select(`*, ${joins.app}, ${joins.createdBy}`)

  if (app_id) {
    query = query.eq('app_id', app_id)
  }

  const { data, error: err } = await query.order('name')

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const pipeline of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, pipeline, 'pipeline'))
  }

  return sanitized
})

/**
 * Returns a single pipeline by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized pipeline record
 * @throws Error('Pipeline ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: pipelines table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'pipeline')
})

/**
 * Creates a new pipeline. Authenticated principal required.
 * Audit log emitted on success.
 *
 * Body: `name`, `trigger_type`, `stages` (all required), plus optional
 * `app_id`, `description`, `config`, `metadata`
 *
 * @returns Inserted pipeline record
 * @throws Error('name, trigger_type, and stages are required')
 * @inputSpec stages: PipelineStage[] — array of stage config objects
 * @inputSpec trigger_type: string — event slug that activates this pipeline
 * @sideEffects DB write: pipelines table (INSERT)
 * @sideEffects audit: emitLog('pipeline.created')
 * @calledBy handler (POST)
 * @testUnit tests/unit/pipelines.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, trigger_type, config, stages, metadata } = body

  if (!name || !trigger_type || !stages) {
    throw new Error('name, trigger_type, and stages are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      trigger_type,
      config: config || {},
      stages,
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline.created', 
    { type: 'pipeline', id: data.id }, 
    { after: { name, trigger_type } }
  )

  return data
})

/**
 * Updates a pipeline. Only `name`, `description`, `config`, `stages`, and
 * `metadata` are patchable. Authenticated principal required. Audit logged.
 *
 * Body/query: `id` (required), plus any of the updatable fields
 *
 * @returns Updated pipeline record
 * @throws Error('Pipeline ID is required')
 * @throws Error('Pipeline not found')
 * @sideEffects DB write: pipelines table (UPDATE)
 * @sideEffects audit: emitLog('pipeline.updated', { before, after })
 * @calledBy handler (PATCH)
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, name, description, config, stages, metadata } = body || {}

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible pipelines
  const { data: current } = await ctx.db
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Pipeline not found')
  }

  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updateData.name = name
  if (description !== undefined) updateData.description = description
  if (config !== undefined) updateData.config = config
  if (stages !== undefined) updateData.stages = stages
  if (metadata !== undefined) updateData.metadata = metadata

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline.updated', 
    { type: 'pipeline', id }, 
    { before: current, after: updateData }
  )

  return data
})

/**
 * Activates or deactivates a pipeline. Use instead of PATCH for is_active
 * changes to ensure `pipeline.toggled` audit event is emitted.
 *
 * Body: `id` (required), `is_active` (required, boolean)
 *
 * @returns Updated pipeline record
 * @throws Error('Pipeline ID and is_active are required')
 * @throws Error('Pipeline not found')
 * @sideEffects DB write: pipelines table (UPDATE is_active)
 * @sideEffects audit: emitLog('pipeline.toggled', { before.is_active, after.is_active })
 * @calledBy handler (POST ?action=toggle)
 */
export const toggle = createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Pipeline ID and is_active are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible pipelines
  const { data: current } = await ctx.db
    .from('pipelines')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Pipeline not found')
  }

  const { data, error: err } = await ctx.db
    .from('pipelines')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'pipeline.toggled', 
    { type: 'pipeline', id }, 
    { before: { is_active: current.is_active }, after: { is_active } }
  )

  return data
})

/**
 * Returns paginated execution history for a pipeline from
 * `pipeline_executions`, ordered newest-first.
 *
 * Query params: `pipeline_id` (required), `limit` (default 50), `offset` (default 0)
 *
 * @returns Array of pipeline_executions rows
 * @throws Error('Pipeline ID is required')
 * @sideEffects DB read: pipeline_executions table
 * @calledBy handler (GET ?action=executions)
 */
export const getExecutions = createHandler(async (ctx, _body) => {
  const { pipeline_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!pipeline_id) {
    throw new Error('Pipeline ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('pipeline_executions')
    .select('*')
    .eq('pipeline_id', pipeline_id)
    .order('created_at', { ascending: false })
    .range(
      parseInt(offset.toString()),
      parseInt(offset.toString()) + parseInt(limit.toString()) - 1
    )

  if (err) throw err

  return data
})

/**
 * Hard-deletes a pipeline by UUID. Audit logged.
 *
 * Query params: `id` (required)
 *
 * @returns `{ success: true }`
 * @throws Error('Pipeline ID is required')
 * @throws Error('Pipeline not found')
 * @sideEffects DB write: pipelines table (DELETE)
 * @sideEffects audit: emitLog('pipeline.deleted', { before })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Pipeline ID is required')
  }

  const { data: current } = await ctx.db
    .from('pipelines')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Pipeline not found')

  const { error: err } = await ctx.db
    .from('pipelines')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'pipeline.deleted', 
    { type: 'pipeline', id }, 
    { before: current }
  )

  return { success: true }
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. See module dispatch table for full routing.
 * @throws Error('Invalid action or method') on unmatched combination
 * @calledBy Netlify function routing
 */
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'by-trigger':
      if (method === 'GET') {
        return await listByTrigger(ctx, body)
      }
      break
    case 'executions':
      if (method === 'GET') {
        return await getExecutions(ctx, body)
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
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
