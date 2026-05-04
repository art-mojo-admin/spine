/**
 * @module api-keys
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * Management and validation API for the `api_keys` table. API keys are
 * issued per-integration and optionally scoped to specific permissions.
 * Key material is generated and stored by the `create_api_key` Postgres
 * RPC, which handles hashing internally. Validation also delegates to the
 * `validate_api_key` RPC.
 *
 * **Routed by:** `GET/POST /.netlify/functions/api-keys`
 *
 * **Actions:**
 * | method | ?action    | handler       |
 * |--------|------------|---------------|
 * | POST   | validate   | validate      |
 * | POST   | revoke     | revoke        |
 * | GET    | usage-logs | listUsageLogs |
 * | GET    | ?id        | get           |
 * | GET    | (default)  | list          |
 * | POST   | —          | create        |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Account context
 * required for creates. No PATCH/DELETE — use `revoke` for deactivation.
 *
 * INVARIANT: Raw key material is never stored. Only the hash is persisted.
 *   `create` returns the plaintext key once via RPC response.
 * INVARIANT: `revoke` soft-deactivates by setting `is_active = false`.
 *
 * @seeAlso integrations.ts (integration_id FK on api_keys)
 * @seeAlso audit.ts (emitLog for api_key.* events)
 */

import { createHandler } from './_shared/middleware'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists API keys for the account with optional filtering.
 *
 * Query params: `integration_id`, `key_type`, `is_active` ('true'/'false'),
 * `expires_before`, `expires_after` (ISO timestamps),
 * `limit` (default 100), `offset` (default 0)
 *
 * @returns Sanitized api_key records ordered by created_at desc
 * @throws Error('Account context required')
 * @sideEffects DB read: api_keys table (with integration + createdBy joins)
 * @calledBy handler (GET, no id)
 */
export const list = createHandler(async (ctx, _body) => {
  const { integration_id, key_type, is_active, expires_before, expires_after, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('api_keys')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      created_by_person:people(id, full_name, email)
    `)
    .order('created_at', { ascending: false })

  if (integration_id) {
    query = query.eq('integration_id', integration_id)
  }
  if (key_type) {
    query = query.eq('key_type', key_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }
  if (expires_before) {
    query = query.lte('expires_at', expires_before)
  }
  if (expires_after) {
    query = query.gte('expires_at', expires_after)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  const sanitized = []
  for (const key of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, key, 'api_key'))
  }

  return sanitized
})

/**
 * Returns a single API key record by UUID. Note: does not return raw key
 * material — only metadata.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized api_key record
 * @throws Error('API key ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: api_keys table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('api_keys')
    .select(`
      *,
      integration:integrations(id, name, provider, integration_type),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'api_key')
})

/**
 * Creates a new API key via the `create_api_key` Postgres RPC.
 * The RPC generates and hashes the key material, returning plaintext once.
 * Audit logged on success.
 *
 * Body: `name` (required), plus optional `integration_id`, `key_type`
 * (default 'private'), `key_prefix` (default 'sk_'), `permissions`,
 * `rate_limit` (default 1000 req/day), `expires_at`, `metadata`
 *
 * @returns RPC result containing `api_key_id` and plaintext `key_value`
 * @throws Error('name is required')
 * @throws Error('Account context required')
 * @inputSpec permissions: object — scoped permission map
 * @inputSpec rate_limit: number — max requests per day
 * @outputSpec key_value: string — ONLY returned here; store securely client-side
 * @sideEffects DB write: api_keys table (via create_api_key RPC)
 * @sideEffects audit: emitLog('api_key.created')
 * @calledBy handler (POST)
 */
export const create = createHandler(async (ctx, body) => {
  const { integration_id, name, key_type, key_prefix, permissions, rate_limit, expires_at, metadata } = body

  if (!name) {
    throw new Error('name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .rpc('create_api_key', {
      integration_id,
      name,
      key_type: key_type || 'private',
      key_prefix: key_prefix || 'sk_',
      permissions: permissions || {},
      rate_limit: rate_limit || 1000,
      expires_at,
      metadata: metadata || {},
      created_by: ctx.principal?.id,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'api_key.created', 
    { type: 'api_key', id: data[0]?.api_key_id }, 
    { after: { name, key_type, rate_limit } }
  )

  return data
})

/**
 * Validates an API key and checks required permissions via the
 * `validate_api_key` Postgres RPC. Used by external callers and
 * integration webhook handlers.
 *
 * Body: `key_value` (required), `required_permissions` (optional object)
 *
 * @returns RPC validation result (is_valid, account_id, permissions, etc.)
 * @throws Error('key_value is required')
 * @sideEffects DB read: validate_api_key RPC
 * @calledBy handler (POST ?action=validate)
 * @calledBy middleware (bearer token API key resolution)
 */
export const validate = createHandler(async (ctx, body) => {
  const { key_value, required_permissions } = body

  if (!key_value) {
    throw new Error('key_value is required')
  }

  const { data, error: err } = await ctx.db
    .rpc('validate_api_key', {
      key_value,
      required_permissions: required_permissions || {}
    })

  if (err) throw err

  return data
})

/**
 * Revokes (soft-deactivates) an API key by UUID. Sets `is_active = false`.
 * Audit logged.
 *
 * Body: `id` (required)
 *
 * @returns Updated api_key record (is_active: false)
 * @throws Error('API key ID is required')
 * @sideEffects DB write: api_keys table (UPDATE is_active=false)
 * @sideEffects audit: emitLog('api_key.revoked')
 * @calledBy handler (POST ?action=revoke)
 */
export const revoke = createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('API key ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('api_keys')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'api_key.revoked', 
    { type: 'api_key', id }, 
    { after: { revoked_by: ctx.principal?.id } }
  )

  return data
})

/**
 * Lists paginated API key usage logs from `api_key_usage_logs`.
 *
 * Query params: `api_key_id`, `response_status` (integer), `success`
 * ('true'/'false'), `date_from`, `date_to` (ISO timestamps),
 * `limit` (default 100), `offset` (default 0)
 *
 * @returns Array of api_key_usage_logs rows with api_key join
 * @throws Error('Account context required')
 * @sideEffects DB read: api_key_usage_logs table
 * @calledBy handler (GET ?action=usage-logs)
 */
export const listUsageLogs = createHandler(async (ctx, _body) => {
  const { api_key_id, response_status, success, date_from, date_to, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('api_key_usage_logs')
    .select(`
      *,
      api_key:api_keys(id, name, key_type)
    `)
    .order('created_at', { ascending: false })

  if (api_key_id) {
    query = query.eq('api_key_id', api_key_id)
  }
  if (response_status) {
    query = query.eq('response_status', parseInt(response_status.toString()))
  }
  if (success !== undefined) {
    query = query.eq('success', success === 'true')
  }
  if (date_from) {
    query = query.gte('created_at', date_from)
  }
  if (date_to) {
    query = query.lte('created_at', date_to)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

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
    case 'validate':
      if (method === 'POST') {
        return await validate(ctx, body)
      }
      break
    case 'revoke':
      if (method === 'POST') {
        return await revoke(ctx, body)
      }
      break
    case 'usage-logs':
      if (method === 'GET') {
        return await listUsageLogs(ctx, body)
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
      }
  }

  throw new Error('Invalid action or method')
})
