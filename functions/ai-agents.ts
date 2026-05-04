/**
 * @module ai-agents
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `ai_agents` table. AI agent records define the configuration
 * for agentic inference workloads: model settings, system prompts, available
 * tools, capabilities, and constraints. The runtime execution is handled by
 * `_shared/agent-runner.ts`.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/ai-agents`
 *
 * **Actions (standard CRUD only):**
 * | method | condition | handler |
 * |--------|-----------|---------|
 * | GET    | ?id       | get     |
 * | GET    | (default) | list    |
 * | POST   | —         | create  |
 * | PATCH  | —         | update  |
 * | DELETE | —         | remove  |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Authenticated
 * principal required for writes.
 *
 * INVARIANT: `remove` is a hard delete.
 * INVARIANT: `update` only patches allowed fields: name, description,
 *   model_config, system_prompt, tools, capabilities, constraints, metadata,
 *   is_active.
 *
 * @seeAlso agent-runner.ts (runAgent — runtime execution using these configs)
 * @seeAlso prompt-configs.ts (prompt_configs referenced by agent configs)
 * @seeAlso audit.ts (emitLog for ai_agent.* events)
 */

import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

const permissions = PermissionEngine as any

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists AI agents for the account with optional filtering.
 *
 * Query params: `agent_type`, `is_active` ('true'/'false'),
 * `limit` (default 100), `offset` (default 0)
 *
 * @returns Sanitized ai_agent records ordered by name
 * @throws Error('Account context required')
 * @sideEffects DB read: ai_agents table (with app + createdBy joins)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/ai-agents.test.ts — 'list'
 */
export const list = createHandler(async (ctx, _body) => {
  const { agent_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('ai_agents')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (agent_type) {
    query = query.eq('agent_type', agent_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  const sanitized = []
  for (const agent of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, agent, 'ai_agent'))
  }

  return sanitized
})

/**
 * Returns a single AI agent by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized ai_agent record
 * @throws Error('Agent ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: ai_agents table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Agent ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('ai_agents')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'ai_agent')
})

/**
 * Creates a new AI agent configuration. Authenticated principal required.
 * Audit log emitted on success.
 *
 * Body: `name`, `agent_type` (required), plus optional `app_id`, `description`,
 * `model_config`, `system_prompt`, `tools`, `capabilities`, `constraints`, `metadata`
 *
 * @returns Inserted ai_agent record
 * @throws Error('name and agent_type are required')
 * @inputSpec model_config: object — LLM provider + model parameters
 * @inputSpec tools: string[] — tool slugs available to this agent
 * @inputSpec capabilities: string[] — high-level capability flags
 * @inputSpec constraints: object — hard limits (rate, scope, etc.)
 * @sideEffects DB write: ai_agents table (INSERT)
 * @sideEffects audit: emitLog('ai_agent.created')
 * @calledBy handler (POST)
 * @testUnit tests/unit/ai-agents.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, agent_type, model_config, system_prompt, tools, capabilities, constraints, metadata } = body

  if (!name || !agent_type) {
    throw new Error('name and agent_type are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('ai_agents')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      agent_type,
      model_config: model_config || {},
      system_prompt: system_prompt || null,
      tools: tools || [],
      capabilities: capabilities || [],
      constraints: constraints || {},
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'ai_agent.created', 
    { type: 'ai_agent', id: data.id }, 
    { after: { name, agent_type } }
  )

  return data
})

/**
 * Updates an AI agent. Only allowed fields are patched.
 * Authenticated principal required. Audit logged.
 *
 * Body/query: `id` (required), plus any allowed fields
 *
 * @returns Updated ai_agent record
 * @throws Error('Agent ID is required')
 * @sideEffects DB write: ai_agents table (UPDATE)
 * @sideEffects audit: emitLog('ai_agent.updated')
 * @calledBy handler (PATCH)
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Agent ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const allowed = ['name', 'description', 'model_config', 'system_prompt', 'tools', 'capabilities', 'constraints', 'metadata', 'is_active']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('ai_agents')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'ai_agent.updated', 
    { type: 'ai_agent', id }, 
    { after: updateData }
  )

  return data
})

/**
 * Hard-deletes an AI agent by UUID. Audit logged.
 *
 * Query params: `id` (required)
 *
 * @returns `{ success: true }`
 * @throws Error('Agent ID is required')
 * @throws Error('Agent not found')
 * @sideEffects DB write: ai_agents table (DELETE)
 * @sideEffects audit: emitLog('ai_agent.deleted', { before })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Agent ID is required')
  }

  const { data: current } = await ctx.db
    .from('ai_agents')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Agent not found')

  const { error: err } = await ctx.db
    .from('ai_agents')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'ai_agent.deleted', 
    { type: 'ai_agent', id }, 
    { before: current }
  )

  return { success: true }
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. Routes by HTTP method:
 * | method | condition | handler |
 * |--------|-----------|---------|
 * | GET    | ?id       | get     |
 * | GET    | (default) | list    |
 * | POST   | —         | create  |
 * | PATCH  | —         | update  |
 * | DELETE | —         | remove  |
 *
 * @throws Error('Invalid action or method')
 * @calledBy Netlify function routing
 */
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
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
