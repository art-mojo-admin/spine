/**
 * @module prompt-configs
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `prompt_configs` table. Prompt configs define LLM inference
 * parameters: system prompts, context templates, model selection, temperature,
 * confidence thresholds, escalation rules, tool access, and knowledge sources.
 * They are referenced by AI agents at inference time via `agent-runner.ts`.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/prompt-configs`
 *
 * **Standard CRUD routing:**
 * | method | condition | handler |
 * |--------|-----------|---------|
 * | GET    | ?id       | get     |
 * | GET    | (default) | list    |
 * | POST   | —         | create  |
 * | PATCH  | —         | update  |
 * | DELETE | —         | remove  |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Account context
 * required for writes.
 *
 * INVARIANT: `remove` is a hard delete.
 * INVARIANT: `update` only patches the explicit allowlist of fields.
 * INVARIANT: `model` defaults to 'gpt-4o', `temperature` to 0.7,
 *   `max_tokens` to 4000 if not specified on create.
 *
 * @seeAlso agent-runner.ts (resolveAgentConfig reads prompt_configs)
 * @seeAlso ai-agents.ts (ai_agents reference prompt_config_id)
 * @seeAlso audit.ts (emitLog for prompt_config.* events)
 */

import { createHandler } from './_shared/middleware'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists prompt configs for the account with optional filtering.
 *
 * Query params: `model`, `is_active` ('true'/'false'),
 * `limit` (default 100), `offset` (default 0)
 *
 * @returns Sanitized prompt_config records ordered by name
 * @throws Error('Account context required')
 * @sideEffects DB read: prompt_configs table (with app + createdBy joins)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/prompt-configs.test.ts — 'list'
 */
export const list = createHandler(async (ctx, _body) => {
  const { model, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('prompt_configs')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people!prompt_configs_created_by_fkey(id, full_name, email)
    `)
    .order('name')

  if (model) {
    query = query.eq('model', model)
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
  for (const config of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, config, 'prompt_config'))
  }

  return sanitized
})

/**
 * Returns a single prompt config by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized prompt_config record
 * @throws Error('Config ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: prompt_configs table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Config ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('prompt_configs')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people!prompt_configs_created_by_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'prompt_config')
})

/**
 * Creates a new prompt config. Account context required. Audit logged.
 *
 * Body: `name`, `slug` (required), plus optional `app_id`, `system_prompt`,
 * `context_template`, `model` (default 'gpt-4o'), `temperature` (default 0.7),
 * `max_tokens` (default 4000), `is_multi_turn` (default true),
 * `max_history_messages` (default 20), `confidence_threshold`,
 * `escalation_action`, `escalation_target`, `output_mode`, `output_field`,
 * `requires_review` (default false), `knowledge_sources`, `available_tools`,
 * `tool_constraints`, `metadata`
 *
 * @returns Inserted prompt_config record
 * @throws Error('name and slug are required')
 * @throws Error('Account context required')
 * @inputSpec slug: string — unique per account, used to reference the config
 * @inputSpec confidence_threshold: number | null — 0–1 range; triggers escalation below
 * @inputSpec knowledge_sources: string[] — knowledge base slugs for RAG
 * @inputSpec available_tools: string[] — tool slugs the agent may call
 * @sideEffects DB write: prompt_configs table (INSERT)
 * @sideEffects audit: emitLog('prompt_config.created')
 * @calledBy handler (POST)
 * @testUnit tests/unit/prompt-configs.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, slug, system_prompt, context_template, model, temperature, max_tokens,
    is_multi_turn, max_history_messages, confidence_threshold, escalation_action, escalation_target,
    output_mode, output_field, requires_review, knowledge_sources, available_tools, tool_constraints,
    metadata } = body

  if (!name || !slug) {
    throw new Error('name and slug are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .from('prompt_configs')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      slug,
      system_prompt: system_prompt || null,
      context_template: context_template || null,
      model: model || 'gpt-4o',
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 4000,
      is_multi_turn: is_multi_turn ?? true,
      max_history_messages: max_history_messages ?? 20,
      confidence_threshold: confidence_threshold || null,
      escalation_action: escalation_action || null,
      escalation_target: escalation_target || null,
      output_mode: output_mode || null,
      output_field: output_field || null,
      requires_review: requires_review ?? false,
      knowledge_sources: knowledge_sources || [],
      available_tools: available_tools || [],
      tool_constraints: tool_constraints || {},
      metadata: metadata || {},
      created_by: ctx.principal?.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'prompt_config.created', 
    { type: 'prompt_config', id: data.id }, 
    { after: { name, slug, model: data.model } }
  )

  return data
})

/**
 * Updates a prompt config. Only allowed fields are patched.
 * Audit logged on success.
 *
 * Body/query: `id` (required), plus any of the allowlisted fields
 *
 * @returns Updated prompt_config record
 * @throws Error('Config ID is required')
 * @sideEffects DB write: prompt_configs table (UPDATE)
 * @sideEffects audit: emitLog('prompt_config.updated')
 * @calledBy handler (PATCH)
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Config ID is required')
  }

  const allowed = ['name', 'slug', 'system_prompt', 'context_template', 'model', 'temperature',
    'max_tokens', 'is_multi_turn', 'max_history_messages', 'confidence_threshold',
    'escalation_action', 'escalation_target', 'output_mode', 'output_field', 'requires_review',
    'knowledge_sources', 'available_tools', 'tool_constraints', 'metadata', 'is_active']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('prompt_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'prompt_config.updated', 
    { type: 'prompt_config', id }, 
    { after: updateData }
  )

  return data
})

/**
 * Hard-deletes a prompt config by UUID. Audit logged.
 *
 * Query params: `id` (required)
 *
 * @returns `{ success: true }`
 * @throws Error('Config ID is required')
 * @throws Error('Prompt config not found')
 * @sideEffects DB write: prompt_configs table (DELETE)
 * @sideEffects audit: emitLog('prompt_config.deleted', { before })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Config ID is required')
  }

  const { data: current } = await ctx.db
    .from('prompt_configs')
    .select('id, name, slug')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Prompt config not found')

  const { error: err } = await ctx.db
    .from('prompt_configs')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'prompt_config.deleted', 
    { type: 'prompt_config', id }, 
    { before: current }
  )

  return { success: true }
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. Standard CRUD routing by method:
 * GET ?id → get | GET → list | POST → create | PATCH → update | DELETE → remove
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
