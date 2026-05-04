/**
 * @module types
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD API for the `types` table. Types are the schema configuration objects
 * that define `design_schema`, `validation_schema`, field definitions, and
 * view configurations for runtime entities (`items`, `people`, `accounts`).
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/types`
 *
 * **Authorization model:**
 * - All reads use `ctx.db` (RLS-scoped) and are sanitized via `sanitizeRecordData`.
 * - All writes (`create`, `update`, `remove`) require `isSystemAdmin` AND the
 *   caller's account must be a master tenant (`accounts.parent_id IS NULL`).
 * - Unauthenticated `list` calls receive minimal fields only (id, slug, name, kind).
 *
 * **Design schema auto-sync:** `update` regenerates `validation_schema` automatically
 * via `generateValidationSchema` whenever `design_schema` changes.
 *
 * INVARIANT: type slugs must be unique per (kind, app_id) combination.
 * INVARIANT: `ownership` of system types cannot be changed (to prevent constraint violations).
 * INVARIANT: `app_id = null` for system types; must be provided for app/tenant types.
 *
 * @seeAlso middleware.ts (createHandler, CoreContext)
 * @seeAlso permissions.ts (PermissionEngine, sanitizeRecordData, validateUpdatePermissions)
 * @seeAlso schema-utils.ts (generateValidationSchema — auto-called on design_schema updates)
 * @seeAlso audit.ts (emitLog for type.created / type.updated / type.deleted)
 */

import { createHandler } from './_shared/middleware'
import { adminDb, joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'
import { generateValidationSchema } from './_shared/schema-utils'

const permissions = PermissionEngine as any

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists active types, with optional filtering by kind, app_id, and ownership.
 * Returns full type records for authenticated principals (design_schema preserved)
 * and minimal {id, slug, name, kind} for unauthenticated callers.
 *
 * Query params: `kind`, `app_id` ('null' to filter NULL), `ownership`,
 * `limit` (default 50), `offset` (default 0)
 *
 * @returns Sanitized type records sorted by kind, name
 * @throws PostgREST error on RLS denial
 * @sideEffects DB read: types table (with app join)
 * @calledBy handler (GET, no id or slug)
 * @testUnit tests/unit/types.test.ts — 'list'
 */
export const list = createHandler(async (ctx, body) => {
  const { kind, app_id, ownership, limit = '50', offset = '0', include_schema } = ctx.query || {}

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('types')
    .select(`*, ${joins.app}`)
    .eq('is_active', true)
    .order('kind')
    .order('name')

  if (kind) {
    query = query.eq('kind', kind)
  }

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else if (app_id === 'null') {
    query = query.is('app_id', null)
  }

  if (ownership) {
    query = query.eq('ownership', ownership)
  }

  const { data, error: err } = await query
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (err) throw err

  // For authenticated users, always include design_schema for schema-driven UI
  // System admin sees everything, others get sanitized data with design_schema preserved
  // When include_schema=true, preserve full design_schema for all accessible types
  const sanitized = []
  for (const type of data || []) {
    if (ctx.principal) {
      // Authenticated user - get sanitized data but preserve design_schema
      const sanitizedType = await sanitizeRecordData(ctx, type, 'type')
      // Ensure design_schema is preserved for schema-driven UI
      if (type.design_schema && !sanitizedType.design_schema) {
        sanitizedType.design_schema = type.design_schema
      }
      // When include_schema=true, also preserve validation_schema
      if (include_schema === 'true' && type.validation_schema) {
        sanitizedType.validation_schema = type.validation_schema
      }
      sanitized.push(sanitizedType)
    } else {
      // Unauthenticated user - return minimal data
      const minimal: any = {
        id: type.id,
        slug: type.slug,
        name: type.name,
        kind: type.kind
      }
      // When include_schema=true, unauthenticated users also get schema
      if (include_schema === 'true' && type.design_schema) {
        minimal.design_schema = type.design_schema
      }
      sanitized.push(minimal)
    }
  }

  return sanitized
})

/**
 * Returns a single active type by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized type record with app join
 * @throws Error('Type ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: types table
 * @calledBy handler (GET ?id)
 * @testUnit tests/unit/types.test.ts — 'get'
 */
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Type ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .select(`*, ${joins.app}`)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'type')
})

/**
 * Returns a single active type by slug.
 *
 * Query params: `slug` (required)
 *
 * @returns Sanitized type record with app join
 * @throws Error('Type slug is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: types table
 * @calledBy handler (GET ?action=get&slug=)
 */
export const getBySlug = createHandler(async (ctx, body) => {
  const { slug } = ctx.query || {}
  
  if (!slug) {
    throw new Error('Type slug is required')
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .select(`*, ${joins.app}`)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Sanitize based on role permissions
  return await sanitizeRecordData(ctx, data, 'type')
})

/**
 * Returns the `design_schema` for a type via the `get_type_schema` RPC.
 * RLS is enforced by the RPC function itself.
 *
 * Query params: `kind` (required), `slug` (required), `app_id` (optional)
 *
 * @returns `{ design_schema: object }`
 * @throws Error('kind and slug are required')
 * @sideEffects DB read: get_type_schema RPC
 * @calledBy handler (GET ?action=schema)
 */
export const getSchema = createHandler(async (ctx, body) => {
  const { kind, slug, app_id } = ctx.query || {}

  if (!kind || !slug) {
    throw new Error('kind and slug are required')
  }

  const { data, error: err } = await ctx.db
    .rpc('get_type_schema', {
      kind,
      slug,
      app_id: app_id || null
    })

  if (err) throw err

  return { design_schema: data }
})

/**
 * Creates a new type. Restricted to system admins whose account is a master
 * tenant (no parent). Generates `validation_schema` from `design_schema`.
 * Audit log emitted on success.
 *
 * Body: `kind`, `slug`, `name` (all required), plus optional `app_id`,
 * `description`, `icon`, `color`, `design_schema`, `ownership`
 *
 * @returns Inserted type record
 * @throws Error('kind, slug, and name are required')
 * @throws Error('Only system administrators can create type configurations')
 * @throws Error('Type configurations can only be created in master tenant accounts')
 * @throws Error('Type slug already exists for this kind and app')
 * @throws Error('Cannot create type without app_id for non-system ownership')
 * @inputSpec kind: 'item' | 'account' | 'person'
 * @inputSpec slug: string — unique per (kind, app_id)
 * @sideEffects DB write: types table (INSERT)
 * @sideEffects DB read: accounts (master tenant check), apps (app_id fallback)
 * @sideEffects audit: emitLog('type.created')
 * @calledBy handler (POST)
 * @calls generateValidationSchema, emitLog
 * @testUnit tests/unit/types.test.ts — 'create'
 * @testIntegration tests/integration/types.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const { app_id, kind, slug, name, description, icon, color, design_schema: bodySchema = {}, ownership } = body

  if (!kind || !slug || !name) {
    throw new Error('kind, slug, and name are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Config mutations (types) are only allowed in master tenant by system admins
  if (!permissions.isSystemAdmin(ctx)) {
    throw new Error('Only system administrators can create type configurations')
  }

  // Verify the current account is a master tenant (parent_id IS NULL)
  // Use adminDb for this check since we're verifying account structure
  const { data: accountData } = await adminDb
    .from('accounts')
    .select('parent_id')
    .eq('id', ctx.accountId!)
    .single()

  if (!accountData || accountData.parent_id !== null) {
    throw new Error('Type configurations can only be created in master tenant accounts')
  }

  // Check if slug is unique within app/kind
  let query = adminDb
    .from('types')
    .select('id')
    .eq('kind', kind)
    .eq('slug', slug)

  if (app_id) {
    query = query.eq('app_id', app_id)
  } else {
    query = query.is('app_id', null)
  }

  const { data: existing } = await query.single()

  if (existing) {
    throw new Error('Type slug already exists for this kind and app')
  }

  // Basic schema validation
  if (bodySchema && typeof bodySchema === 'object') {
    if (bodySchema.fields && (typeof bodySchema.fields !== 'object' || bodySchema.fields === null)) {
      throw new Error('Schema fields must be an object')
    }
  }

  // For non-system ownership, we need an app_id to satisfy the constraint
  let finalAppId = app_id
  let finalOwnership = ownership
  
  if (!app_id && ownership !== 'system') {
    // Get the first available app for tenant/custom types
    const { data: apps } = await adminDb
      .from('apps')
      .select('id')
      .limit(1)
      .single()
    
    if (apps?.id) {
      finalAppId = apps.id
      finalOwnership = 'app' // Use 'app' ownership when associated with an app
    } else {
      throw new Error('Cannot create type without app_id for non-system ownership')
    }
  }

  // Generate validation schema from design schema
  const validationSchema = generateValidationSchema(bodySchema || {})

  const { data, error: err } = await adminDb
    .from('types')
    .insert({
      app_id: finalAppId,
      kind,
      slug,
      name,
      description,
      icon,
      color,
      design_schema: bodySchema || {},
      validation_schema: validationSchema,
      ownership: finalOwnership || 'system',
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.created', { type: 'type', id: data.id }, { after: data })

  return data
})

/**
 * Updates an existing type. System admin + master tenant required.
 * Auto-regenerates `validation_schema` when `design_schema` changes.
 * Prevents `ownership` changes on system types.
 *
 * Body/query: `id` (required), plus any updatable fields
 *
 * @returns Updated type record
 * @throws Error('Only system administrators can update type configurations')
 * @throws Error('Type configurations can only be updated in master tenant accounts')
 * @throws Error('Type not found')
 * @throws Error from validateUpdatePermissions on field-level violations
 * @sideEffects DB write: types table (UPDATE)
 * @sideEffects audit: emitLog('type.updated', { before, after })
 * @calledBy handler (PATCH)
 * @calls generateValidationSchema, emitLog, validateUpdatePermissions
 * @testUnit tests/unit/types.test.ts — 'update'
 */
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Type ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible types
  const { data: current } = await adminDb
    .from('types')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Type not found')
  }

  // Config mutations (types) are only allowed in master tenant by system admins
  if (!permissions.isSystemAdmin(ctx)) {
    throw new Error('Only system administrators can update type configurations')
  }

  // System types can only be updated by system admins (already checked above)
  // App types require app ownership verification
  if (current.ownership === 'app' && current.app_id) {
    // Verify user has access to this app
    const { data: appAccess } = await adminDb
      .from('apps')
      .select('id')
      .eq('id', current.app_id)
      .eq('is_active', true)
      .single()
    
    if (!appAccess) {
      throw new Error('App not found or inactive')
    }
  }

  // Verify the current account is a master tenant (parent_id IS NULL)
  // Use adminDb for this check since we're verifying account structure
  const { data: accountData } = await adminDb
    .from('accounts')
    .select('parent_id')
    .eq('id', ctx.accountId!)
    .single()

  if (!accountData || accountData.parent_id !== null) {
    throw new Error('Type configurations can only be updated in master tenant accounts')
  }

  // Validate field-level permissions
  const fieldValidation = await permissions.validateUpdatePermissions(
    ctx,
    updates,
    current,
    'type'
  )
  
  if (!fieldValidation.valid) {
    throw new Error(fieldValidation.error)
  }

  // Prevent ownership changes for system types to avoid constraint violations
  if (current.ownership === 'system' && updates.ownership && updates.ownership !== 'system') {
    // Remove ownership from updates to preserve system ownership
    delete updates.ownership
  }

  // Handle app_id null conversion for system types
  if (updates.app_id === '') {
    updates.app_id = null
  }

  // Validate design_schema if being updated
  if (updates.design_schema) {
    if (typeof updates.design_schema !== 'object' || updates.design_schema === null) {
      throw new Error('Design schema must be an object')
    }
    if (updates.design_schema.fields && (typeof updates.design_schema.fields !== 'object' || updates.design_schema.fields === null)) {
      throw new Error('Design schema fields must be an object')
    }
    
    // Auto-generate validation_schema when design_schema changes
    updates.validation_schema = generateValidationSchema(updates.design_schema)
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.updated', { type: 'type', id }, { before: current, after: data })

  return data
})

/**
 * Soft-deletes a type (sets `is_active = false`). System admin + master
 * tenant required.
 *
 * Body/query: `id` (required)
 *
 * @returns Updated type record (with is_active: false)
 * @throws Error('Only system administrators can delete type configurations')
 * @throws Error('Type configurations can only be deleted in master tenant accounts')
 * @throws Error('Type not found')
 * @sideEffects DB write: types table (UPDATE is_active=false)
 * @sideEffects audit: emitLog('type.deleted', { before })
 * @calledBy handler (DELETE)
 * @calls emitLog
 * @testUnit tests/unit/types.test.ts — 'remove'
 */
export const remove = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id

  if (!id) {
    throw new Error('Type ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  // Get current state for audit - RLS will filter to accessible types
  const { data: current } = await ctx.db
    .from('types')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Type not found')
  }

  // Config mutations (types) are only allowed in master tenant by system admins
  if (!permissions.isSystemAdmin(ctx)) {
    throw new Error('Only system administrators can delete type configurations')
  }

  // System types can only be deleted by system admins (already checked above)
  // App types require app ownership verification
  if (current.ownership === 'app' && current.app_id) {
    // Verify user has access to this app
    const { data: appAccess } = await ctx.db
      .from('apps')
      .select('id')
      .eq('id', current.app_id)
      .eq('is_active', true)
      .single()
    
    if (!appAccess) {
      throw new Error('App not found or inactive')
    }
  }

  // Verify the current account is a master tenant (parent_id IS NULL)
  // Use adminDb for this check since we're verifying account structure
  const { data: accountData } = await adminDb
    .from('accounts')
    .select('parent_id')
    .eq('id', ctx.accountId!)
    .single()

  if (!accountData || accountData.parent_id !== null) {
    throw new Error('Type configurations can only be deleted in master tenant accounts')
  }

  const { data, error: err } = await ctx.db
    .from('types')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.deleted', { type: 'type', id }, { before: current })

  return data
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. Routes by HTTP method + action param:
 * | method | condition          | handler    |
 * |--------|--------------------|------------|
 * | GET    | ?action=get&slug   | getBySlug  |
 * | GET    | ?id                | get        |
 * | GET    | ?action=schema     | getSchema  |
 * | GET    | (default)          | list       |
 * | POST   | —                  | create     |
 * | PATCH  | —                  | update     |
 * | DELETE | —                  | remove     |
 *
 * @throws Error('Unsupported method') on unmatched method
 * @calledBy Netlify function routing
 */
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'
  const action = ctx.query?.action

  switch (method) {
    case 'GET':
      if (action === 'get' && ctx.query?.slug) {
        return await getBySlug(ctx, body)
      } else if (ctx.query?.id) {
        return await get(ctx, body)
      } else if (action === 'schema') {
        return await getSchema(ctx, body)
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
