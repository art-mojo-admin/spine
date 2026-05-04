/**
 * @module integrations
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `integrations` table. Integration records describe
 * third-party service connections (API credentials, provider, version,
 * configuration). Each integration is scoped to an account and optionally
 * to an app. `is_configured` tracks whether credentials have been set.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/integrations`
 *
 * **Standard CRUD — routes directly by HTTP method (no ?action switch):**
 * | method | condition | handler |
 * |--------|-----------|---------|
 * | GET    | ?id       | get     |
 * | GET    | (default) | list    |
 * | POST   | —         | create  |
 * | PATCH  | —         | update  |
 * | DELETE | —         | remove (soft) |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Authenticated
 * principal required for writes.
 *
 * INVARIANT: `remove` is a soft delete (sets `is_active = false`). Hard deletes
 *   are not supported to preserve audit trails on integration-linked data.
 * INVARIANT: `update` only patches the explicit allowlist of fields.
 *
 * @seeAlso api-keys.ts (api_keys belong to integrations)
 * @seeAlso trigger-engine.ts (integration webhooks trigger pipelines)
 * @seeAlso audit.ts (emitLog for integration.* events)
 */

import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists integrations for the account with optional filtering.
 *
 * Query params: `integration_type`, `provider`, `is_active` ('true'/'false'),
 * `is_configured` ('true'/'false'), `limit` (default 100), `offset` (default 0)
 *
 * @returns Sanitized integration records ordered by name
 * @throws Error('Account context required')
 * @sideEffects DB read: integrations table (with app + createdBy joins)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/integrations.test.ts — 'list'
 */
export const list = createHandler(async (ctx, _body) => {
  const { integration_type, provider, is_active, is_configured, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('integrations')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (integration_type) {
    query = query.eq('integration_type', integration_type)
  }
  if (provider) {
    query = query.eq('provider', provider)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }
  if (is_configured !== undefined) {
    query = query.eq('is_configured', is_configured === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  const sanitized = []
  for (const integration of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, integration, 'integration'))
  }

  return sanitized
})

/**
 * Returns a single integration by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized integration record
 * @throws Error('Integration ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: integrations table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('integrations')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'integration')
})

/**
 * Creates a new integration record. Authenticated principal required.
 * Audit logged on success.
 *
 * Body: `name`, `integration_type`, `provider` (required), plus optional
 * `app_id`, `description`, `version` (default '1.0.0'), `config`, `credentials`,
 * `metadata`
 *
 * @returns Inserted integration record
 * @throws Error('name, integration_type, and provider are required')
 * @inputSpec credentials: object — sensitive; stored encrypted at rest via DB policy
 * @inputSpec is_configured: boolean — set to true once credentials are populated
 * @sideEffects DB write: integrations table (INSERT)
 * @sideEffects audit: emitLog('integration.created')
 * @calledBy handler (POST)
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, integration_type, provider, version, config, credentials, metadata } = body

  if (!name || !integration_type || !provider) {
    throw new Error('name, integration_type, and provider are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('integrations')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      integration_type,
      provider,
      version: version || '1.0.0',
      config: config || {},
      credentials: credentials || {},
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'integration.created', 
    { type: 'integration', id: data.id }, 
    { after: { name, integration_type, provider } }
  )

  return data
})

/**
 * Updates an integration. Only allowed fields are patched. Audit logged.
 *
 * Body/query: `id` (required), plus any of: name, description,
 * integration_type, provider, version, config, credentials, metadata,
 * is_active, is_configured
 *
 * @returns Updated integration record
 * @throws Error('Integration ID is required')
 * @sideEffects DB write: integrations table (UPDATE)
 * @sideEffects audit: emitLog('integration.updated')
 * @calledBy handler (PATCH)
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const allowed = ['name', 'description', 'integration_type', 'provider', 'version', 'config', 'credentials', 'metadata', 'is_active', 'is_configured']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('integrations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'integration.updated', 
    { type: 'integration', id }, 
    { after: updateData }
  )

  return data
})

/**
 * Soft-deletes an integration (sets `is_active = false`). Audit logged.
 *
 * Query params: `id` (required)
 *
 * @returns Updated integration record (is_active: false)
 * @throws Error('Integration ID is required')
 * @throws Error('Integration not found')
 * @sideEffects DB write: integrations table (UPDATE is_active=false)
 * @sideEffects audit: emitLog('integration.deleted', { before, after })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data: current } = await ctx.db
    .from('integrations')
    .select('id, name, provider')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Integration not found')

  const { data, error: err } = await ctx.db
    .from('integrations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'integration.deleted',
    { type: 'integration', id },
    { before: current, after: { is_active: false } }
  )

  return data
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. Routes directly by HTTP method (no ?action).
 * GET ?id → get | GET → list | POST → create | PATCH → update | DELETE → remove
 * @throws Error('Unsupported method: <method>')
 * @calledBy Netlify function routing
 */
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.id) {
        return await get(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      return await create(ctx, body)
    case 'PATCH':
      return await update(ctx, body)
    case 'DELETE':
      return await remove(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
