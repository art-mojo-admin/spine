/**
 * @module apps
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `apps` table. Apps are the installable units of functionality
 * in Spine v2. They group types, roles, integrations, and nav configuration.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/apps`
 *
 * **Authorization model:**
 * - `list` / `get` / `getSchema` / `checkAvailability`: any authenticated principal
 *   (RLS-scoped via `ctx.db`). Returns sanitized records.
 * - `create`: requires `isSystemAdmin` or first-surface `canCreate` permission.
 * - `update` / `remove`: requires authenticated principal + field-level permission
 *   check via `validateUpdatePermissions`.
 * - `updateVersion`: authenticated principal via RPC.
 *
 * INVARIANT: app slugs are globally unique across the `apps` table.
 * INVARIANT: `is_system` apps can only be manipulated by system admins.
 *
 * @seeAlso middleware.ts (createHandler)
 * @seeAlso permissions.ts (PermissionEngine, sanitizeRecordData)
 * @seeAlso audit.ts (emitLog for app.created / app.updated / app.deleted)
 * @seeAlso types.ts (types reference apps via app_id)
 */

import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

const permissions = PermissionEngine as any

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists apps accessible to the account via the `get_account_apps` RPC.
 * RLS is enforced by the RPC function.
 *
 * Query params:
 *   - `account_id` (default: ctx.accountId)
 *   - `include_system` (default: true)
 *   - `include_inactive` (default: false)
 *
 * @returns Sanitized app records
 * @throws Error('Account context required')
 * @sideEffects DB read: get_account_apps RPC
 * @calledBy handler (GET, no id/slug)
 * @testUnit tests/unit/apps.test.ts — 'list'
 */
export const list = createHandler(async (ctx, body) => {
  const { include_system, include_inactive, account_id } = ctx.query || {}

  const targetAccountId = account_id || ctx.accountId

  if (!targetAccountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  const { data, error: err } = await ctx.db
    .rpc('get_account_apps', {
      account_id: targetAccountId,
      include_system: include_system !== 'false',
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  // Sanitize each record based on role permissions
  const sanitized = []
  for (const app of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, app, 'app'))
  }

  return sanitized
})

/**
 * Returns a single active app by UUID or slug. Fetches with owner account join.
 *
 * Query params: `id` OR `slug` (one required)
 *
 * @returns Sanitized app record with ownerAccount join
 * @throws Error('App ID or slug is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: apps table
 * @calledBy handler (GET ?id or ?slug)
 */
export const get = createHandler(async (ctx, body) => {
  const { id, slug } = ctx.query || {}
  
  if (!id && !slug) {
    throw new Error('App ID or slug is required')
  }

  let query = ctx.db
    .from('apps')
    .select(`*, ${joins.ownerAccount}`)
    .eq('is_active', true)

  if (id) {
    query = query.eq('id', id)
  } else {
    query = query.eq('slug', slug)
  }

  const { data, error: err } = await query.single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'app')
})

/**
 * Returns the full app schema (types, roles, views, integrations) via the
 * `get_app_schema` RPC. RLS enforced by RPC.
 *
 * Query params: `slug` (required)
 *
 * @returns App schema object
 * @throws Error('App slug is required')
 * @sideEffects DB read: get_app_schema RPC
 * @calledBy handler (GET ?action=schema)
 */
export const getSchema = createHandler(async (ctx, body) => {
  const { slug } = ctx.query || {}

  if (!slug) {
    throw new Error('App slug is required')
  }

  const { data, error: err } = await ctx.db
    .rpc('get_app_schema', { app_slug: slug })

  if (err) throw err

  return data
})

/**
 * Creates a new app. Requires system admin or first-surface `canCreate` permission.
 * Audit log emitted on success.
 *
 * Body: `slug`, `name` (required), plus optional `description`, `icon`, `color`,
 * `version`, `app_type`, `source`, `owner_account_id`, `config`, `nav_items`,
 * `min_role`, `integration_deps`, `metadata`
 *
 * @returns Inserted app record
 * @throws Error('slug and name are required')
 * @throws Error('Insufficient permissions to create apps')
 * @throws Error('App slug already exists')
 * @inputSpec slug: string — globally unique
 * @inputSpec version: string (default '1.0.0')
 * @sideEffects DB write: apps table (INSERT)
 * @sideEffects audit: emitLog('app.created')
 * @calledBy handler (POST)
 * @calls emitLog
 * @testUnit tests/unit/apps.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { slug, name, description, icon, color, version, app_type, source, owner_account_id, config, nav_items, min_role, integration_deps, metadata, route_prefix, renderer } = body

  if (!slug || !name) {
    throw new Error('slug and name are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Check create permissions
  if (!permissions.isSystemAdmin(ctx)) {
    const perms = await permissions.resolveFirstSurfacePermissions(
      ctx.principal.id,
      ctx.accountId!,
      'app',
      'create'
    )
    
    if (!perms.canCreate) {
      throw new Error('Insufficient permissions to create apps')
    }
  }

  // Check if slug is unique
  const { data: existing } = await ctx.db
    .from('apps')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    throw new Error('App slug already exists')
  }

  const { data, error: err } = await ctx.db
    .from('apps')
    .insert({
      slug,
      name,
      description,
      icon,
      color,
      version: version || '1.0.0',
      app_type: app_type || 'custom',
      source: source || 'custom',
      owner_account_id: owner_account_id || ctx.accountId,
      config: config || {},
      nav_items: nav_items || [],
      min_role: min_role || 'member',
      integration_deps: integration_deps || [],
      metadata: metadata || {},
      route_prefix: route_prefix !== undefined ? route_prefix : ('/' + slug),
      renderer: renderer || 'generic',
      is_active: true,
      is_system: false
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app.created', { type: 'app', id: data.id }, { after: data })

  return data
})

/**
 * Updates an app. Requires authenticated principal. Field-level permissions
 * validated via `validateUpdatePermissions`. Audit log emitted on success.
 *
 * Body/query: `id` (required), plus any updatable fields
 *
 * @returns Updated app record
 * @throws Error('App ID is required')
 * @throws Error('App not found')
 * @throws Error from validateUpdatePermissions
 * @sideEffects DB write: apps table (UPDATE)
 * @sideEffects audit: emitLog('app.updated', { before, after })
 * @calledBy handler (PATCH)
 * @calls emitLog, validateUpdatePermissions
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('App ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible apps
  const { data: current } = await ctx.db
    .from('apps')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('App not found')
  }

  // Validate field-level permissions
  const fieldValidation = await permissions.validateUpdatePermissions(
    ctx,
    updates,
    current,
    'app'
  )
  
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error)
  }

  const { data, error: err } = await ctx.db
    .from('apps')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app.updated', { type: 'app', id }, { before: current, after: data })

  return data
})

/**
 * Soft-deletes an app (sets `is_active = false`). Audit log emitted on success.
 *
 * Body/query: `id` (required)
 *
 * @returns Updated app record (with is_active: false)
 * @throws Error('App ID is required')
 * @throws Error('App not found')
 * @sideEffects DB write: apps table (UPDATE is_active=false)
 * @sideEffects audit: emitLog('app.deleted', { before })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id

  if (!id) {
    throw new Error('App ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible apps
  const { data: current } = await ctx.db
    .from('apps')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('App not found')
  }

  const { data, error: err } = await ctx.db
    .from('apps')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app.deleted', { type: 'app', id }, { before: current })

  return data
})

/**
 * Checks whether an app is available (installed and active) for an account
 * via the `is_app_available` RPC.
 *
 * Query params: `slug` (required)
 *
 * @returns `{ available: boolean }`
 * @throws Error('App slug is required')
 * @throws Error('Account context required')
 * @sideEffects DB read: is_app_available RPC
 * @calledBy handler (GET ?action=available)
 */
export const checkAvailability = createHandler(async (ctx, body) => {
  const { slug } = ctx.query || {}

  if (!slug) {
    throw new Error('App slug is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await ctx.db
    .rpc('is_app_available', {
      app_slug: slug,
      account_id: ctx.accountId
    })

  if (err) throw err

  return { available: data }
})

/**
 * Updates the version string for an app via the `update_app_version` RPC.
 * Emits audit log on success.
 *
 * Body: `id` (required), `version` (required, semver string)
 *
 * @returns `{ success: true }`
 * @throws Error('App ID and version are required')
 * @sideEffects DB write: update_app_version RPC
 * @sideEffects audit: emitLog('app.version_updated')
 * @calledBy handler (POST ?action=version)
 */
export const updateVersion = createHandler(async (ctx, body) => {
  const { id, version } = body

  if (!id || !version) {
    throw new Error('App ID and version are required')
  }

  const { data, error: err } = await ctx.db
    .rpc('update_app_version', {
      app_id: id,
      new_version: version
    })

  if (err) throw err

  await emitLog(ctx, 'app.version_updated', { type: 'app', id }, { after: { version } })

  return { success: true }
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. Routes by HTTP method + action/id/slug params:
 * | method | condition               | handler          |
 * |--------|-------------------------|------------------|
 * | GET    | ?action=get or ?id      | get              |
 * | GET    | ?slug                   | get (by slug)    |
 * | GET    | ?action=schema          | getSchema        |
 * | GET    | ?action=available       | checkAvailability|
 * | GET    | (default)               | list             |
 * | POST   | ?action=version         | updateVersion    |
 * | POST   | (default)               | create           |
 * | PATCH  | —                       | update           |
 * | DELETE | —                       | remove           |
 *
 * @throws Error('Unsupported method')
 * @calledBy Netlify function routing
 */
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.action === 'get' || ctx.query?.id) {
        return await get(ctx, body)
      } else if (ctx.query?.slug) {
        return await get(ctx, body)
      } else if (ctx.query?.action === 'schema') {
        return await getSchema(ctx, body)
      } else if (ctx.query?.action === 'available') {
        return await checkAvailability(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      if (ctx.query?.action === 'version') {
        return await updateVersion(ctx, body)
      } else {
        return await create(ctx, body)
      }
    case 'PATCH':
      return await update(ctx, body)
    case 'DELETE':
      return await remove(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
