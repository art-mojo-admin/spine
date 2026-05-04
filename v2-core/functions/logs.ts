/**
 * @module logs
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * Read API for the `v2.logs` table plus a write endpoint for external log
 * ingestion. The `logs` table schema uses internal column names
 * (`level`, `source`, `source_type`, `source_id`, `context`) that differ from
 * the stable frontend contract. All reads are mapped through `mapLogRow`.
 *
 * **Routed by:** `GET/POST /.netlify/functions/logs`
 *
 * **Actions:**
 * | method | ?action | handler      |
 * |--------|---------|------------------|
 * | GET    | account | listAccount  |
 * | GET    | target  | listTarget   |
 * | GET    | person  | listPerson   |
 * | GET    | stats   | getStats     |
 * | GET    | search  | search       |
 * | POST   | cleanup | cleanup      |
 * | POST   | (default)| log         |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped, always filtered
 * to `account_id`). No inserts are made by this module — `emitLog` from
 * `_shared/audit.ts` is the canonical write path.
 *
 * **Column mapping (DB → API):**
 * | DB column    | API field   |
 * |--------------|-------------|
 * | level        | event_type  |
 * | person_id    | actor_id    |
 * | source_type  | target_type |
 * | source_id    | target_id   |
 * | source       | action      |
 * | context      | details     |
 *
 * @seeAlso audit.ts (emitLog — canonical write path for all system events)
 * @seeAlso observability.ts (aggregated metrics over logs)
 */

import { createHandler, json, error, parseBody } from './_shared/middleware'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Maps a raw `v2.logs` row to the stable frontend API contract.
 * Applied to all list/search results before returning.
 */
function mapLogRow(row: any) {
  return {
    id: row.id,
    event_type: row.level,
    actor_id: row.person_id,
    target_type: row.source_type,
    target_id: row.source_id,
    action: row.source,
    message: row.message,
    details: row.context,
    metadata: row.metadata,
    created_at: row.created_at,
  }
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists all log entries for the account, newest-first.
 *
 * Query params: `event_type` (maps to DB `level`), `target_type` (maps to
 * `source_type`), `date_from`, `date_to` (ISO timestamps),
 * `limit` (default 100), `offset` (default 0)
 *
 * @returns Array of mapped log rows
 * @throws Error('Account context required')
 * @sideEffects DB read: logs table
 * @calledBy handler (GET ?action=account)
 */
export const listAccount = createHandler(async (ctx, body) => {
  const { event_type, target_type, date_from, date_to, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('logs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (event_type) query = query.eq('level', event_type)
  if (target_type) query = query.eq('source_type', target_type)
  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return (data || []).map(mapLogRow)
})

/**
 * Lists log entries for a specific target entity, newest-first.
 *
 * Query params: `target_type` (required), `target_id` (required),
 * `event_type`, `limit` (default 100), `offset` (default 0)
 *
 * @returns Array of mapped log rows
 * @throws Error('target_type and target_id are required')
 * @throws Error('Account context required')
 * @sideEffects DB read: logs table
 * @calledBy handler (GET ?action=target)
 */
export const listTarget = createHandler(async (ctx, body) => {
  const { target_type, target_id, event_type, limit = 100, offset = 0 } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('logs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('source_type', target_type)
    .eq('source_id', target_id)
    .order('created_at', { ascending: false })

  if (event_type) query = query.eq('level', event_type)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return (data || []).map(mapLogRow)
})

/**
 * Returns activity feed for a person (defaults to the current principal).
 * Excludes system-level events unless `include_system=true`.
 *
 * Query params: `person_id` (optional, defaults to ctx.principal.id),
 * `include_system` ('true'), `limit` (default 50), `offset` (default 0)
 *
 * @returns Array of mapped log rows
 * @throws Error('Person ID is required')
 * @throws Error('Account context required')
 * @sideEffects DB read: logs table
 * @calledBy handler (GET ?action=person)
 */
export const listPerson = createHandler(async (ctx, body) => {
  const { person_id, include_system, limit = 50, offset = 0 } = ctx.query || {}

  const targetPersonId = person_id || ctx.principal?.id

  if (!targetPersonId) {
    throw new Error('Person ID is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('logs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('person_id', targetPersonId)
    .order('created_at', { ascending: false })

  if (include_system !== 'true') {
    query = query.neq('level', 'system')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return (data || []).map(mapLogRow)
})

/**
 * Returns log counts by event_type for the account within an optional
 * date range. Pulls only `id` and `level` columns for efficiency.
 *
 * Query params: `date_from`, `date_to` (ISO timestamps, optional)
 *
 * @returns `{ total: number, by_type: Record<string, number> }`
 * @throws Error('Account context required')
 * @sideEffects DB read: logs table (id + level only)
 * @calledBy handler (GET ?action=stats)
 */
export const getStats = createHandler(async (ctx, body) => {
  const { date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('logs')
    .select('id, level')
    .eq('account_id', ctx.accountId)

  if (date_from) query = query.gte('created_at', date_from)
  if (date_to) query = query.lte('created_at', date_to)

  const { data, error: err } = await query

  if (err) throw err

  const rows = data || []
  const by_type: Record<string, number> = {}
  for (const row of rows) {
    by_type[row.level] = (by_type[row.level] || 0) + 1
  }

  return { total: rows.length, by_type }
})

/**
 * Full-text search on log `message` using case-insensitive ILIKE.
 *
 * Query params: `query` (required, search term), `event_type`,
 * `target_type`, `limit` (default 50), `offset` (default 0)
 *
 * @returns Array of mapped log rows
 * @throws Error('Search query is required')
 * @throws Error('Account context required')
 * @sideEffects DB read: logs table (ILIKE scan)
 * @calledBy handler (GET ?action=search)
 */
export const search = createHandler(async (ctx, body) => {
  const { query: searchQuery, event_type, target_type, limit = 50, offset = 0 } = ctx.query || {}

  if (!searchQuery) {
    throw new Error('Search query is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('logs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .ilike('message', `%${searchQuery}%`)
    .order('created_at', { ascending: false })

  if (event_type) query = query.eq('level', event_type)
  if (target_type) query = query.eq('source_type', target_type)

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return (data || []).map(mapLogRow)
})

/**
 * Writes a single log entry. Intended for external callers or manual
 * instrumentation. Prefer `emitLog` from `_shared/audit.ts` for
 * internal system events.
 *
 * Body: `event_type` (required), plus optional `target_type`, `target_id`,
 * `action`, `message`, `details`, `metadata`
 *
 * @returns `{ log_id: string }`
 * @throws Error('event_type is required')
 * @throws Error('Account context required')
 * @sideEffects DB write: logs table (INSERT)
 * @calledBy handler (POST, default action)
 */
export const log = createHandler(async (ctx, body) => {
  const { event_type, target_type, target_id, action, message, details, metadata } = body

  if (!event_type) {
    throw new Error('event_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .from('logs')
    .insert({
      level: event_type,
      message: message || action || event_type,
      source: action || null,
      source_type: target_type || null,
      source_id: target_id || null,
      person_id: ctx.principal?.id || null,
      account_id: ctx.accountId,
      context: details || {},
      metadata: metadata || {},
    })
    .select('id')
    .single()

  if (err) throw err

  return { log_id: data?.id }
})

/**
 * Deletes log entries older than `days_to_keep` (default 90) for the
 * account. Scoped by RLS — only accessible logs are deleted.
 *
 * Body: `days_to_keep` (optional, default 90)
 *
 * @returns `{ deleted_count: number }`
 * @sideEffects DB write: logs table (DELETE WHERE created_at < cutoff)
 * @calledBy handler (POST ?action=cleanup)
 * @calledBy system-cron.ts (scheduled log rotation)
 */
export const cleanup = createHandler(async (ctx, body) => {
  const { days_to_keep = 90 } = body

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - parseInt(days_to_keep.toString()))

  const { data, error: err } = await ctx.db
    .from('logs')
    .delete()
    .lt('created_at', cutoff.toISOString())
    .select('id')

  if (err) throw err

  return { deleted_count: (data || []).length }
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
    case 'account':
      if (method === 'GET') return await listAccount(ctx, body)
      break
    case 'target':
      if (method === 'GET') return await listTarget(ctx, body)
      break
    case 'person':
      if (method === 'GET') return await listPerson(ctx, body)
      break
    case 'stats':
      if (method === 'GET') return await getStats(ctx, body)
      break
    case 'search':
      if (method === 'GET') return await search(ctx, body)
      break
    case 'cleanup':
      if (method === 'POST') return await cleanup(ctx, body)
      break
    default:
      if (method === 'POST') return await log(ctx, body)
  }

  throw new Error('Invalid action or method')
})
