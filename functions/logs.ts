import { createHandler, json, error, parseBody } from './_shared/middleware'

// ── Helpers ──────────────────────────────────────────────
// v2.logs columns: id, level, message, context, source, source_type, source_id,
//                  person_id, account_id, metadata, created_at
// Frontend expects: id, event_type, actor_id, target_type, target_id, action,
//                   details, metadata, created_at
// We map at the edge so the UI contract is stable.
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

// ── List logs for account ────────────────────────────────
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

// ── List logs for a specific target ──────────────────────
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

// ── Person activity feed ─────────────────────────────────
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

// ── Log statistics ───────────────────────────────────────
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

// ── Search logs ──────────────────────────────────────────
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

// ── Write a log entry (internal use) ─────────────────────
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

// ── Cleanup old logs (admin only) ────────────────────────
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

// ── Main handler ─────────────────────────────────────────
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
