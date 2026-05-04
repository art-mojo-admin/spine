/**
 * @module triggers
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `triggers` table, plus execution history access.
 * Triggers bind event types to pipelines. When an event fires, the trigger
 * engine evaluates active triggers via `_shared/trigger-engine.ts`.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/triggers`
 *
 * **Actions:**
 * | method | ?action    | handler       |
 * |--------|------------|---------------|
 * | GET    | by-event   | listByEvent   |
 * | GET    | executions | getExecutions |
 * | POST   | toggle     | toggle        |
 * | GET    | ?id        | get           |
 * | GET    | (default)  | list          |
 * | POST   | —          | create        |
 * | PATCH  | —          | update        |
 * | DELETE | —          | remove (soft) |
 *
 * **Authorization:** `create` requires system admin OR first-surface `canCreate`
 * permission. All other operations use `ctx.db` RLS.
 *
 * Also exports `AGENT_EVENT_TYPES` constant and `getAgentEventTypes()` helper
 * for referencing well-known agent event slugs in trigger configuration.
 *
 * @seeAlso trigger-engine.ts (checkAndFireTriggers — runtime evaluation)
 * @seeAlso pipelines.ts (pipeline_id FK on triggers)
 * @seeAlso audit.ts (emitLog for trigger.* events)
 */

import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

const permissions = PermissionEngine as any

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────

/**
 * Well-known agent event type slugs for use in trigger `event_type` config.
 * These are emitted by `agent-runner.ts` during inference, tool dispatch,
 * and escalation workflows.
 */
export const AGENT_EVENT_TYPES = {
  // Inference events
  INFERENCE_COMPLETED: 'agent.inference.completed',
  INFERENCE_FAILED: 'agent.inference.failed',
  LOW_CONFIDENCE: 'agent.inference.low_confidence',
  
  // Tool events
  TOOL_CALLED: 'agent.tool.called',
  TOOL_COMPLETED: 'agent.tool.completed',
  TOOL_FAILED: 'agent.tool.failed',
  
  // Conversation events
  MESSAGE_RECEIVED: 'agent.message.received',
  MESSAGE_SENT: 'agent.message.sent',
  THREAD_CREATED: 'agent.thread.created',
  
  // Escalation events
  ESCALATION_TRIGGERED: 'agent.escalation.triggered',
  ESCALATION_RESOLVED: 'agent.escalation.resolved',
  HUMAN_HANDOFF: 'agent.human.handoff'
} as const

/**
 * Returns all agent event type slugs as a flat string array.
 * Useful for populating trigger event_type dropdowns.
 *
 * @returns string[] — all values from AGENT_EVENT_TYPES
 */
export function getAgentEventTypes(): string[] {
  return Object.values(AGENT_EVENT_TYPES)
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists active triggers filtered by `event_type`.
 *
 * Query params: `event_type` (required), `app_id`, `include_inactive` ('true')
 *
 * @returns Sanitized trigger records ordered by name
 * @throws Error('event_type is required')
 * @throws Error('Account context required')
 * @sideEffects DB read: triggers table
 * @calledBy handler (GET ?action=by-event)
 */
export const listByEvent = createHandler(async (ctx, body) => {
  const { event_type, app_id, include_inactive } = ctx.query || {}

  if (!event_type) {
    throw new Error('event_type is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('triggers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('event_type', event_type)
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  }
  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const trigger of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, trigger, 'trigger'))
  }

  return sanitized
})

/**
 * Lists all triggers for the account, with optional filtering.
 *
 * Query params: `app_id`, `event_type`, `include_inactive` ('true')
 *
 * @returns Sanitized trigger records ordered by name
 * @throws Error('Account context required')
 * @sideEffects DB read: triggers table (with app + createdBy joins)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/triggers.test.ts — 'list'
 */
export const list = createHandler(async (ctx, body) => {
  const { app_id, event_type, include_inactive } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('triggers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
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

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const trigger of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, trigger, 'trigger'))
  }

  return sanitized
})

/**
 * Returns a single trigger by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized trigger record
 * @throws Error('Trigger ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: triggers table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'trigger')
})

/**
 * Creates a new trigger. Requires system admin or first-surface `canCreate`.
 * Audit log emitted on success.
 *
 * Body: `name`, `trigger_type` (required), plus optional `app_id`,
 * `description`, `event_type`, `config`, `pipeline_id`, `metadata`, `is_active`
 *
 * @returns Inserted trigger record
 * @throws Error('name and trigger_type are required')
 * @throws Error('Insufficient permissions to create triggers')
 * @inputSpec trigger_type: string — entity lifecycle event slug
 * @inputSpec config: object — filter conditions for trigger evaluation
 * @inputSpec pipeline_id: string | null — pipeline to run on match
 * @sideEffects DB write: triggers table (INSERT)
 * @sideEffects audit: emitLog('trigger.created')
 * @calledBy handler (POST)
 * @testUnit tests/unit/triggers.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, trigger_type, event_type, config, pipeline_id, metadata, is_active } = body

  if (!name || !trigger_type) {
    throw new Error('name and trigger_type are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Check create permissions
  if (!permissions.isSystemAdmin(ctx)) {
    const perms = await permissions.resolveFirstSurfacePermissions(
      ctx.principal.id,
      ctx.accountId!,
      'trigger',
      'create'
    )
    
    if (!perms.canCreate) {
      throw new Error('Insufficient permissions to create triggers')
    }
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .insert({
      app_id,
      name,
      description,
      trigger_type,
      event_type,
      config: config || {},
      pipeline_id: pipeline_id || null,
      metadata: metadata || {},
      is_active: is_active ?? true,
      created_by: ctx.principal.id,
      account_id: ctx.accountId
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.created', 
    { type: 'trigger', id: data.id }, 
    { after: data }
  )

  return data
})

/**
 * Updates a trigger. Authenticated principal required. Audit logged.
 *
 * Body/query: `id` (required), plus any updatable fields
 *
 * @returns Updated trigger record
 * @throws Error('Trigger ID is required')
 * @throws Error('Trigger not found')
 * @sideEffects DB write: triggers table (UPDATE)
 * @sideEffects audit: emitLog('trigger.updated', { before, after })
 * @calledBy handler (PATCH)
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, app_id, name, description, trigger_type, event_type, config, pipeline_id, metadata, is_active } = body || {}

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible triggers
  const { data: current } = await ctx.db
    .from('triggers')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Trigger not found')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .update({
      app_id,
      name,
      description,
      trigger_type,
      event_type,
      config,
      pipeline_id,
      metadata,
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.updated', 
    { type: 'trigger', id }, 
    { before: current, after: data }
  )

  return data
})

/**
 * Soft-deletes a trigger (sets `is_active = false`). Audit logged.
 *
 * Body/query: `id` (required)
 *
 * @returns Updated trigger record (with is_active: false)
 * @throws Error('Trigger ID is required')
 * @throws Error('Trigger not found')
 * @sideEffects DB write: triggers table (UPDATE is_active=false)
 * @sideEffects audit: emitLog('trigger.deleted', { before, after })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id

  if (!id) {
    throw new Error('Trigger ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible triggers
  const { data: current } = await ctx.db
    .from('triggers')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Trigger not found')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.deleted',
    { type: 'trigger', id },
    { before: current, after: data }
  )

  return data
})

/**
 * Activates or deactivates a trigger. Emits `trigger.toggled` audit event.
 *
 * Body: `id` (required), `is_active` (required, boolean)
 *
 * @returns Updated trigger record
 * @throws Error('Trigger ID and is_active are required')
 * @sideEffects DB write: triggers table (UPDATE is_active)
 * @sideEffects audit: emitLog('trigger.toggled')
 * @calledBy handler (POST ?action=toggle)
 */
export const toggle = createHandler(async (ctx, body) => {
  const { id, is_active } = body

  if (!id || is_active === undefined) {
    throw new Error('Trigger ID and is_active are required')
  }

  const { data, error: err } = await ctx.db
    .from('triggers')
    .update({
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'trigger.toggled', 
    { type: 'trigger', id }, 
    { after: { is_active } }
  )

  return data
})

/**
 * Returns paginated execution history from `trigger_executions`, newest-first.
 *
 * Query params: `trigger_id` (required), `limit` (default 50), `offset` (default 0)
 *
 * @returns Array of trigger_executions rows
 * @throws Error('Trigger ID is required')
 * @sideEffects DB read: trigger_executions table
 * @calledBy handler (GET ?action=executions)
 */
export const getExecutions = createHandler(async (ctx, body) => {
  const { trigger_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!trigger_id) {
    throw new Error('Trigger ID is required')
  }

  const parsedLimit = parseInt(limit.toString())
  const parsedOffset = parseInt(offset.toString())

  const { data, error: err } = await ctx.db
    .from('trigger_executions')
    .select('*')
    .eq('trigger_id', trigger_id)
    .order('triggered_at', { ascending: false })
    .range(parsedOffset, parsedOffset + parsedLimit - 1)

  if (err) throw err

  return data
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
    case 'by-event':
      if (method === 'GET') {
        return await listByEvent(ctx, body)
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
