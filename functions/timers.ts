/**
 * @module timers
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `timers` table. Timers are scheduled pipeline triggers
 * (cron-style). They are evaluated and fired by `system-cron.ts` on each
 * scheduled invocation.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/timers`
 *
 * **Actions:**
 * | method | ?action  | handler  |
 * |--------|----------|----------|
 * | POST   | toggle   | toggle   |
 * | GET    | ?id      | get      |
 * | GET    | (default)| list     |
 * | POST   | —        | create   |
 * | PATCH  | —        | update   |
 * | DELETE | —        | remove (hard) |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Authenticated
 * principal required for writes.
 *
 * INVARIANT: `remove` is a hard delete.
 * INVARIANT: `update` only patches allowed fields: name, description, config,
 *   pipeline_id, metadata, is_active.
 *
 * @seeAlso system-cron.ts (fires timers on schedule)
 * @seeAlso pipelines.ts (pipeline_id FK on timers)
 * @seeAlso audit.ts (emitLog for timer.* events)
 */

import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists timers for the account with optional filtering.
 *
 * Query params: `app_id`, `timer_type`, `is_active` ('true'/'false')
 *
 * @returns Sanitized timer records ordered by name
 * @throws Error('Account context required')
 * @sideEffects DB read: timers table (with app + createdBy joins)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/timers.test.ts — 'list'
 */
export const list = createHandler(async (ctx, _body) => {
  const { app_id, timer_type, is_active } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('timers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (timer_type) {
    query = query.eq('timer_type', timer_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }

  const { data, error: err } = await query

  if (err) throw err

  const sanitized = []
  for (const timer of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, timer, 'timer'))
  }

  return sanitized
})

/**
 * Returns a single timer by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized timer record
 * @throws Error('Timer ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: timers table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'timer')
})

/**
 * Creates a new timer. Authenticated principal required. Audit logged.
 *
 * Body: `name`, `timer_type` (required), plus optional `app_id`,
 * `description`, `config` (cron schedule etc.), `pipeline_id`, `metadata`
 *
 * @returns Inserted timer record
 * @throws Error('name and timer_type are required')
 * @inputSpec timer_type: string — e.g. 'cron', 'interval'
 * @inputSpec config: object — schedule config (cron expression, interval)
 * @sideEffects DB write: timers table (INSERT)
 * @sideEffects audit: emitLog('timer.created')
 * @calledBy handler (POST)
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, timer_type, config, pipeline_id, metadata } = body

  if (!name || !timer_type) {
    throw new Error('name and timer_type are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      timer_type,
      config: config || {},
      pipeline_id: pipeline_id || null,
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'timer.created', 
    { type: 'timer', id: data.id }, 
    { after: { name, timer_type } }
  )

  return data
})

/**
 * Updates a timer. Only patchable fields: `name`, `description`, `config`,
 * `pipeline_id`, `metadata`, `is_active`. Audit logged.
 *
 * Body/query: `id` (required), plus any allowed fields
 *
 * @returns Updated timer record
 * @throws Error('Timer ID is required')
 * @sideEffects DB write: timers table (UPDATE)
 * @sideEffects audit: emitLog('timer.updated')
 * @calledBy handler (PATCH)
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const allowed = ['name', 'description', 'config', 'pipeline_id', 'metadata', 'is_active']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'timer.updated', 
    { type: 'timer', id }, 
    { after: updateData }
  )

  return data
})

/**
 * Activates or deactivates a timer. Emits `timer.toggled` audit event.
 *
 * Body: `id` (required), `is_active` (required, boolean)
 *
 * @returns Updated timer record
 * @throws Error('Timer ID and is_active are required')
 * @sideEffects DB write: timers table (UPDATE is_active)
 * @sideEffects audit: emitLog('timer.toggled')
 * @calledBy handler (POST ?action=toggle)
 */
export const toggle = createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Timer ID and is_active are required')
  }

  const { data, error: err } = await ctx.db
    .from('timers')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'timer.toggled', 
    { type: 'timer', id }, 
    { after: { is_active } }
  )

  return data
})

/**
 * Hard-deletes a timer by UUID. Audit logged.
 *
 * Query params: `id` (required)
 *
 * @returns `{ success: true }`
 * @throws Error('Timer ID is required')
 * @throws Error('Timer not found')
 * @sideEffects DB write: timers table (DELETE)
 * @sideEffects audit: emitLog('timer.deleted', { before })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Timer ID is required')
  }

  const { data: current } = await ctx.db
    .from('timers')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Timer not found')

  const { error: err } = await ctx.db
    .from('timers')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'timer.deleted', 
    { type: 'timer', id }, 
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
