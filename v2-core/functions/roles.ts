/**
 * @module roles
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `roles` table. Roles define permission sets (`permissions`
 * JSONB) that are assigned to people within an account.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/roles`
 *
 * **Authorization model:**
 * - All reads use `ctx.db` (RLS-scoped). System admins see raw records;
 *   others get field-level sanitization via `sanitizeRecordData`.
 * - `create`: requires system admin OR first-surface `canCreate` permission.
 *   Creating a role with `slug === 'system_admin'` is system-admin-only.
 * - `update` / `remove`: require authenticated principal. RLS controls row
 *   access; field-level permissions validated via `validateUpdatePermissions`.
 * - Slug uniqueness is enforced per-app: checked against `adminDb`.
 *
 * INVARIANT: `system_admin` role slug can only be created by system admins.
 * INVARIANT: soft delete only — roles are set to `is_active = false`.
 *
 * @seeAlso middleware.ts (createHandler)
 * @seeAlso permissions.ts (PermissionEngine, sanitizeRecordData)
 * @seeAlso audit.ts (emitLog for role.created / role.updated / role.deleted)
 */

import { createHandler } from './_shared/middleware'
import { adminDb } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

const permissions = PermissionEngine as any

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists active roles with optional filtering by app_id and is_system.
 * System admins receive raw records; others receive sanitized records.
 *
 * Query params: `app_id` ('null' for no-app roles), `is_system` ('true'/'false'),
 * `limit` (default 50), `offset` (default 0)
 *
 * @returns Array of role records with app join
 * @throws PostgREST error on RLS denial
 * @sideEffects DB read: roles table (with app join)
 * @calledBy handler (GET, no id)
 * @testUnit tests/unit/roles.test.ts — 'list'
 */
export const list = createHandler(async (ctx, _body) => {
  const { app_id, is_system, limit = '50', offset = '0' } = ctx.query || {}

  // RLS automatically filters to accessible roles
  let query = ctx.db
    .from('roles')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('is_active', true)
    .order('is_system', { ascending: false })
    .order('name')

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else if (app_id === 'null') {
    query = query.is('app_id', null)
  }

  if (is_system !== undefined) {
    query = query.eq('is_system', is_system === 'true')
  }

  const { data, error: err } = await query
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (err) throw err

  // System admin sees everything without additional filtering
  if (permissions.isSystemAdmin(ctx)) {
    return data
  }

  // Filter each role based on field-level permissions
  const filteredData = []
  for (const role of data || []) {
    const roleWithType = { ...role, type: 'role' }
    const sanitizedRole = await sanitizeRecordData(ctx, roleWithType, 'role')
      filteredData.push(sanitizedRole)
  }

  return filteredData
})

/**
 * Returns a single active role by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized role record with app join
 * @throws Error('Role ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: roles table
 * @calledBy handler (GET ?id)
 */
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Role ID is required')
  }

  // RLS ensures user can only access roles in their accessible accounts
  const { data, error: err } = await ctx.db
    .from('roles')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Return sanitized data based on field-level permissions
  const roleWithType = { ...data, type: 'role' }
  return await sanitizeRecordData(ctx, roleWithType, 'role')
})

/**
 * Creates a new role. Requires system admin or first-surface `canCreate` permission.
 * `system_admin` slug is system-admin-only. Slug uniqueness verified against adminDb.
 * Audit log emitted on success.
 *
 * Body: `slug`, `name` (required), plus optional `app_id`, `description`,
 * `permissions` (JSONB), `is_system`
 *
 * @returns Inserted role record
 * @throws Error('slug and name are required')
 * @throws Error('system_admin role can only be created by system administrators')
 * @throws Error('Insufficient permissions to create roles')
 * @throws Error('Role slug already exists for this app')
 * @inputSpec slug: string — unique per app_id
 * @inputSpec permissions: Record<string, any> — JSONB permission config
 * @sideEffects DB write: roles table (INSERT)
 * @sideEffects audit: emitLog('role.created')
 * @calledBy handler (POST)
 * @calls emitLog
 * @testUnit tests/unit/roles.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, slug, name, description, permissions: rolePermissions, is_system } = body

  if (!slug || !name) {
    throw new Error('slug and name are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Guard: system_admin role can only be created by system admins
  if (slug === 'system_admin' && !permissions.isSystemAdmin(ctx)) {
    throw new Error('system_admin role can only be created by system administrators')
  }

  // Check create permissions using PermissionEngine
  if (!permissions.isSystemAdmin(ctx)) {
    const perms = await permissions.resolveFirstSurfacePermissions(
      ctx.principal.id,
      ctx.accountId!,
      'role',
      'create'
    )
    
    if (!perms.canCreate) {
      throw new Error('Insufficient permissions to create roles')
    }
  }

  // Check if slug is unique within app using service role (validating uniqueness is a system concern)
  let query = adminDb
    .from('roles')
    .select('id')
    .eq('slug', slug)

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else {
    query = query.is('app_id', null)
  }

  const { data: existing } = await query.single()

  if (existing) {
    throw new Error('Role slug already exists for this app')
  }

  // Insert with RLS enforcement
  const { data, error: err } = await ctx.db
    .from('roles')
    .insert({
      app_id,
      slug,
      name,
      description,
      permissions: rolePermissions || {},
      is_system: is_system || false,
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.created', { type: 'role', id: data.id }, { after: data })

  return data
})

/**
 * Updates a role. Authenticated principal required. Field-level permissions
 * validated. Audit log emitted on success.
 *
 * Body: `id` (required), plus any updatable fields
 *
 * @returns Updated role record
 * @throws Error('Role ID is required')
 * @throws Error('Role not found or access denied')
 * @throws Error from validateUpdatePermissions
 * @sideEffects DB write: roles table (UPDATE)
 * @sideEffects audit: emitLog('role.updated', { before, after })
 * @calledBy handler (PATCH)
 * @calls emitLog, validateUpdatePermissions
 */
export const update = createHandler(async (ctx, body) => {
  const { id, ...updates } = body

  if (!id) {
    throw new Error('Role ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit via RLS
  const { data: current, error: fetchErr } = await ctx.db
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    throw new Error('Role not found or access denied')
  }

  // Validate field-level permissions
  const fieldValidation = await permissions.validateUpdatePermissions(
    ctx,
    updates,
    current,
    'role'
  )
  
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error)
  }

  // Update via RLS
  const { data, error: err } = await ctx.db
    .from('roles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.updated', { type: 'role', id }, { before: current, after: data })

  return data
})

/**
 * Soft-deletes a role (sets `is_active = false`). Audit log emitted on success.
 *
 * Body: `id` (required)
 *
 * @returns Updated role record (with is_active: false)
 * @throws Error('Role ID is required')
 * @throws Error('Role not found or access denied')
 * @sideEffects DB write: roles table (UPDATE is_active=false)
 * @sideEffects audit: emitLog('role.deleted', { before })
 * @calledBy handler (DELETE)
 */
export const remove = createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Role ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Verify access via RLS fetch
  const { data: current, error: fetchErr } = await ctx.db
    .from('roles')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) {
    throw new Error('Role not found or access denied')
  }

  // Soft delete via RLS
  const { data, error: err } = await ctx.db
    .from('roles')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'role.deleted', { type: 'role', id }, { before: current })

  return data
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
 * @throws Error('Unsupported method')
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
