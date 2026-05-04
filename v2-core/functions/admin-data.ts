/**
 * @module admin-data
 * @audience both
 * @layer api-handler
 * @stability stable
 *
 * Generic CRUD API for all runtime entities. Provides list, get, create,
 * update, delete, and stats operations over a validated set of entity tables.
 *
 * **Routed by:** `GET/POST/PATCH/DELETE /.netlify/functions/admin-data`
 *
 * **Dispatch table (query params → handler):**
 * | method | ?action | ?id present | Handler |
 * |--------|---------|-------------|---------|
 * | GET    | list    | any         | `list`  |
 * | GET    | get     | any         | `get`   |
 * | GET    | stats   | any         | `stats` |
 * | GET    | —       | yes         | `get`   |
 * | GET    | —       | no          | `list`  |
 * | POST   | —       | —           | `create`|
 * | PATCH  | —       | —           | `update`|
 * | DELETE | —       | —           | `remove`|
 *
 * **Authorization:** All DB reads/writes use `ctx.db` (RLS-scoped client).
 * RLS policies on each table enforce account hierarchy access automatically.
 * `adminDb` is used only for lookups that need bypass (type resolution).
 *
 * **Valid entities:** `accounts`, `people`, `items`, `threads`, `messages`,
 * `links`, `attachments`, `watchers`.
 *
 * INVARIANT: every `create` call requires `type_id` in the body — all runtime
 *   records must reference a type.
 * INVARIANT: trigger dispatch (create/update/delete) is fire-and-forget —
 *   trigger failures are logged but never surface to the caller.
 * INVARIANT: all returned records are passed through `sanitizeRecordData`
 *   before being returned — field-level permission stripping is always applied.
 *
 * @seeAlso middleware.ts (createHandler, CoreContext)
 * @seeAlso permissions.ts (sanitizeRecordData)
 * @seeAlso trigger-engine.ts (fire*Triggers)
 * @seeAlso types.ts (types table, design_schema, validation_schema)
 */

import { createHandler } from './_shared/middleware'
import { sanitizeRecordData } from './_shared/permissions'
import { adminDb } from './_shared/db'
import { fireCreateTriggers, fireUpdateTriggers, fireDeleteTriggers } from './_shared/trigger-engine'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PERMISSIONS_ALL = {
  record_permissions: { all: ['create', 'read', 'update', 'delete'] },
  fields: {}
}

/**
 * Allowlist of entity table names accepted by this handler.
 * Any entity string not in this set causes a 400-equivalent throw.
 */
const VALID_ENTITIES = ['accounts', 'people', 'items', 'threads', 'messages', 'links', 'attachments', 'watchers']

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists records for an entity with optional filtering, search, sorting, and
 * pagination. Scoped by account via RLS on `ctx.db`.
 *
 * Query params:
 *   - `entity` (required) — one of VALID_ENTITIES
 *   - `type_slug` — filter items by type slug (resolves to item_type_id)
 *   - `search` — ilike search on entity's primary display field
 *   - `sort_field` (default: 'created_at'), `sort_direction` (default: 'desc')
 *   - `limit` (default: 50), `offset` (default: 0)
 *   - `view` — if set with type_slug, include design_schema + resolved view in response
 *   - all other query params are applied as equality filters
 *
 * @returns Array of sanitized records, or `{ data, schema, view }` if `?view` is set
 * @throws Error('Valid entity parameter is required') — missing or invalid entity
 * @inputSpec entity: string — must be in VALID_ENTITIES
 * @inputSpec limit: number — max 50 per call; adjust offset for pagination
 * @outputSpec sanitized records per sanitizeRecordData permission rules
 * @sideEffects DB read: entity table + optional types lookup for type_slug/view
 * @calledBy handler (GET ?action=list or GET with no id)
 * @calls sanitizeRecordData, adminDb (type_slug/view resolution)
 * @testUnit tests/unit/admin-data.test.ts — 'list'
 * @testIntegration tests/integration/admin-data.test.ts — 'list'
 */
export const list = createHandler(async (ctx, _body) => {
  // Extract all reserved query params to prevent them from being used as column filters
  const { entity, action, method, search, sort_field = 'created_at', sort_direction = 'desc', limit = 50, offset = 0, type_slug, view: viewSlug, ...filters } = ctx.query || {}

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    throw new Error('Valid entity parameter is required')
  }

  // Use ctx.db - RLS-scoped client based on principal
  // RLS policies enforce account hierarchy access automatically
  let query = ctx.db.from(entity).select('*')

  // Apply type_slug filter if provided (for schema-driven entities)
  if (type_slug && entity === 'items') {
    // Look up the type ID from the slug
    const { data: typeRecord } = await adminDb
      .from('types')
      .select('id')
      .eq('slug', type_slug)
      .eq('is_active', true)
      .single()
    
    if (typeRecord) {
      query = query.eq('type_id', typeRecord.id)
    }
  }

  // Apply search if provided
  if (search) {
    // Search in display field based on entity
    const searchField = getSearchField(entity)
    query = query.ilike(searchField, `%${search}%`)
  }

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'is_active' || key === 'is_verified' || key === 'is_primary') {
        query = query.eq(key, value === 'true')
      } else {
        query = query.eq(key, value)
      }
    }
  })

  // Apply sorting
  query = query.order(sort_field, { ascending: sort_direction === 'asc' })

  // Get total count (RLS filters automatically)
  const { count, error: countError } = await ctx.db.from(entity)
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('List count error:', countError)
    throw new Error(countError.message || 'Database error getting count')
  }

  // Apply pagination
  query = query.range(parseInt(offset.toString()), parseInt(offset.toString()) + parseInt(limit.toString()) - 1)

  const { data, error: err } = await query

  if (err) {
    console.error('List query error:', err)
    throw new Error(err.message || 'Database error listing records')
  }

  // RLS policies already filtered the data - just sanitize
  const sanitizedData = []
  for (const record of data || []) {
    const sanitizedRecord = await sanitizeRecordData(ctx, record, entity)
    sanitizedData.push(sanitizedRecord)
  }

  // If ?view=slug was requested, resolve schema + view config from the type record
  if (viewSlug && type_slug) {
    const { data: typeRecord } = await adminDb
      .from('types')
      .select('design_schema')
      .eq('slug', type_slug)
      .eq('is_active', true)
      .single()

    if (typeRecord?.design_schema) {
      const schema = typeRecord.design_schema
      const resolvedView = schema.views?.[viewSlug] || null
      return { data: sanitizedData, schema, view: resolvedView }
    }
  }

  return sanitizedData
})

/**
 * Returns a single record by ID. Scoped by account via RLS on `ctx.db`.
 *
 * Query params:
 *   - `entity` (required) — one of VALID_ENTITIES
 *   - `id` (required) — UUID of the record
 *   - `view` — if set and the record has `design_schema.views[viewSlug]`,
 *     returns `{ data, schema, view }` instead of the bare record
 *
 * @returns Sanitized record, or `{ data, schema, view }` if `?view` is set
 * @throws Error('Valid entity parameter is required')
 * @throws Error('ID parameter is required')
 * @throws Error('Record not found') — or re-throws PostgREST error on RLS denial
 * @inputSpec id: string — valid UUID
 * @outputSpec sanitized record per sanitizeRecordData permission rules
 * @sideEffects DB read: entity table
 * @calledBy handler (GET ?action=get or GET with ?id)
 * @calls sanitizeRecordData
 * @testUnit tests/unit/admin-data.test.ts — 'get'
 */
export const get = createHandler(async (ctx, _body) => {
  const { entity, id, view: viewSlug } = ctx.query || {}

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    throw new Error('Valid entity parameter is required')
  }

  if (!id) {
    throw new Error('ID parameter is required')
  }

  // RLS will filter based on account hierarchy access
  const { data, error: err } = await ctx.db.from(entity)
    .select('*')
    .eq('id', id)
    .single()

  if (err) throw err

  if (!data) {
    throw new Error('Record not found')
  }

  const sanitizedRecord = await sanitizeRecordData(ctx, data, entity)

  // If ?view=slug was requested, include schema + resolved view from the record's stamped schema
  if (viewSlug && sanitizedRecord?.design_schema) {
    const schema = sanitizedRecord.design_schema
    const resolvedView = schema.views?.[viewSlug] || null
    return { data: sanitizedRecord, schema, view: resolvedView }
  }

  return sanitizedRecord
})

/**
 * Creates a new record for an entity. Stamps `design_schema`,
 * `validation_schema`, audit fields, and `account_id` from the resolved type.
 * Fires `*_created` triggers asynchronously after DB insert.
 *
 * Body params:
 *   - `entity` (required) — one of VALID_ENTITIES
 *   - `type_id` (required) — UUID of an active type record
 *   - all other fields are passed through to the insert
 *
 * @returns Sanitized created record
 * @throws Error('Valid entity parameter is required')
 * @throws Error('type_id is required')
 * @throws Error('type_id not found') — if type UUID doesn't exist
 * @throws Error('type_id references an inactive type')
 * @throws PostgREST error on RLS INSERT denial
 * @inputSpec type_id: string — valid UUID of active type record
 * @inputSpec body fields: Record<string, any> — record field values
 * @outputSpec sanitized created record
 * @sideEffects DB write: entity table (INSERT)
 * @sideEffects DB read: types table (type resolution)
 * @sideEffects fire-and-forget: fireCreateTriggers
 * @calledBy handler (POST)
 * @calls sanitizeRecordData, adminDb (type lookup), fireCreateTriggers
 * @testUnit tests/unit/admin-data.test.ts — 'create'
 * @testIntegration tests/integration/admin-data.test.ts — 'create'
 */
export const create = createHandler(async (ctx, body) => {
  const entity = body?.entity || ctx.query?.entity
  const { entity: _e, ...recordData } = body || {}

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    const e: any = new Error('Valid entity parameter is required'); e.statusCode = 400; throw e
  }

  // type_id is required on all runtime record creation
  if (!recordData.type_id) {
    const e: any = new Error('type_id is required — every runtime record must reference a type'); e.statusCode = 400; throw e
  }

  // Look up the type to stamp design_schema and validation_schema
  const { data: typeRecord, error: typeErr } = await adminDb
    .from('types')
    .select('id, design_schema, validation_schema, is_active')
    .eq('id', recordData.type_id)
    .single()

  if (typeErr || !typeRecord) {
    throw new Error(`type_id not found: ${recordData.type_id}`)
  }

  if (!typeRecord.is_active) {
    throw new Error(`type_id references an inactive type: ${recordData.type_id}`)
  }

  // Ensure the type has at least permissions=ALL (defensive — migration 062 guarantees this)
  let designSchema = typeRecord.design_schema || {}
  if (!designSchema.record_permissions) {
    designSchema = { ...PERMISSIONS_ALL, ...designSchema }
  }

  // Add audit fields + stamped schema
  const dataToInsert = {
    ...recordData,
    design_schema:     designSchema,
    validation_schema: typeRecord.validation_schema || {},
    created_by: ctx.principal?.id,
    account_id: ctx.accountId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // RLS will check if user has INSERT permission on this account
  const { data, error: err } = await ctx.db.from(entity)
    .insert(dataToInsert)
    .select()
    .single()

  if (err) throw err

  // Fire triggers asynchronously (don't block response)
  const entityData = { ...dataToInsert, id: data.id }
  fireCreateTriggers(entity, data.id, entityData, ctx).catch(console.error)

  return await sanitizeRecordData(ctx, data, entity)
})

/**
 * Updates an existing record by ID. Stamps `updated_by` and `updated_at`.
 * Fires `*_updated` triggers asynchronously after DB update.
 *
 * Query params: `entity` (required), `id` (required)
 * Body: partial record fields to update (no schema re-stamping on update)
 *
 * @returns Sanitized updated record
 * @throws Error('Valid entity parameter is required')
 * @throws Error('ID is required for update')
 * @throws PostgREST error on RLS UPDATE denial
 * @inputSpec id: string — valid UUID of existing record
 * @inputSpec body: Partial<Record> — fields to patch
 * @outputSpec sanitized updated record
 * @sideEffects DB write: entity table (UPDATE)
 * @sideEffects fire-and-forget: fireUpdateTriggers
 * @calledBy handler (PATCH)
 * @calls sanitizeRecordData, fireUpdateTriggers
 * @testUnit tests/unit/admin-data.test.ts — 'update'
 */
export const update = createHandler(async (ctx, body) => {
  const { entity, id } = ctx.query || {}
  const recordData = body

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    throw new Error('Valid entity parameter is required')
  }

  if (!id) {
    throw new Error('ID is required for update')
  }

  // Add audit fields
  const dataToUpdate = {
    ...recordData,
    updated_by: ctx.principal?.id,
    updated_at: new Date().toISOString()
  }

  // RLS will check UPDATE permission on this record
  const { data, error: err } = await ctx.db.from(entity)
    .update(dataToUpdate)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  // Fire triggers asynchronously (don't block response)
  const entityData = { ...data, ...dataToUpdate }
  fireUpdateTriggers(entity, id, entityData, ctx).catch(console.error)

  return await sanitizeRecordData(ctx, data, entity)
})

/**
 * Deletes a record by ID. Defaults to soft delete (`is_active = false`) for
 * entities that support it; falls back to hard delete otherwise.
 *
 * Query params:
 *   - `entity` (required) — one of VALID_ENTITIES
 *   - `id` (required) — UUID of the record
 *   - `soft` (default: 'true') — set to 'false' to force hard delete
 *
 * Soft-delete-capable entities: `accounts`, `people`, `items`, `threads`,
 * `messages`, `watchers`. All others always receive a hard delete.
 *
 * @returns `{ deleted: true, soft: true, data }` (soft) or `{ deleted: true, soft: false }` (hard)
 * @throws Error('Valid entity parameter is required')
 * @throws Error('ID is required for delete')
 * @throws PostgREST error on RLS DELETE denial
 * @inputSpec id: string — valid UUID
 * @inputSpec soft: 'true' | 'false'
 * @outputSpec { deleted: boolean, soft: boolean, data?: sanitizedRecord }
 * @sideEffects DB write: UPDATE is_active=false (soft) or DELETE (hard)
 * @sideEffects fire-and-forget: fireDeleteTriggers
 * @calledBy handler (DELETE)
 * @calls sanitizeRecordData, entitySupportsSoftDelete, fireDeleteTriggers
 * @testUnit tests/unit/admin-data.test.ts — 'remove'
 */
export const remove = createHandler(async (ctx, _body) => {
  const { entity, id, soft = 'true' } = ctx.query || {}

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    throw new Error('Valid entity parameter is required')
  }

  if (!id) {
    throw new Error('ID is required for delete')
  }

  const isSoftDelete = soft === 'true'

  if (isSoftDelete && entitySupportsSoftDelete(entity)) {
    // Soft delete - set is_active to false
    // RLS will check DELETE permission on this record
    const { data, error: err } = await ctx.db.from(entity)
      .update({
        is_active: false,
        updated_by: ctx.principal?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (err) throw err
    return { deleted: true, soft: true, data: await sanitizeRecordData(ctx, data, entity) }
  } else {
    // Hard delete
    // RLS will check DELETE permission on this record
    const { error: err } = await ctx.db.from(entity)
      .delete()
      .eq('id', id)

    if (err) throw err
    return { deleted: true, soft: false }
  }
})

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Returns the primary text field to use for `ilike` search for a given entity.
 * Falls back to 'id' for unmapped entities.
 *
 * @calledBy list (search param handling)
 */
function getSearchField(entity: string): string {
  const searchFields: Record<string, string> = {
    accounts: 'display_name',
    people: 'full_name',
    items: 'title',
    threads: 'title',
    messages: 'content',
    links: 'link_type',
    attachments: 'filename',
    watchers: 'watch_type'
  }
  return searchFields[entity] || 'id'
}

/**
 * Returns true if the entity has an `is_active` column and supports soft delete.
 *
 * @calledBy remove
 */
function entitySupportsSoftDelete(entity: string): boolean {
  const softDeleteEntities = ['accounts', 'people', 'items', 'threads', 'messages', 'watchers']
  return softDeleteEntities.includes(entity)
}

/**
 * Returns total record count for an entity, scoped by account via RLS.
 *
 * Query params: `entity` (required)
 *
 * @returns `{ entity: string, count: number }`
 * @throws Error('Valid entity parameter is required')
 * @sideEffects DB read: entity table (count query)
 * @calledBy handler (GET ?action=stats)
 * @testUnit tests/unit/admin-data.test.ts — 'stats'
 */
export const stats = createHandler(async (ctx, _body) => {
  const { entity } = ctx.query || {}

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    throw new Error('Valid entity parameter is required')
  }

  // RLS will filter count based on account hierarchy access
  const { count, error: err } = await ctx.db.from(entity)
    .select('*', { count: 'exact', head: true })

  if (err) throw err

  return { entity, count }
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. Routes to list/get/create/update/remove/stats
 * based on HTTP method and `?action` query param.
 *
 * Route table:
 * | method | ?action | ?id | → handler |
 * |--------|---------|-----|------------|
 * | GET    | list    | —   | list       |
 * | GET    | get     | —   | get        |
 * | GET    | stats   | —   | stats      |
 * | GET    | —       | yes | get        |
 * | GET    | —       | no  | list       |
 * | POST   | —       | —   | create     |
 * | PATCH  | —       | —   | update     |
 * | DELETE | —       | —   | remove     |
 *
 * @throws Error('Invalid action or method') on unmatched combination
 * @calledBy Netlify function routing
 * @calls list, get, create, update, remove, stats
 */
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'list':
      if (method === 'GET') {
        return await list(ctx, body)
      }
      break
    case 'get':
      if (method === 'GET') {
        return await get(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await stats(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.id) {
        return await get(ctx, body)
      } else if (method === 'GET') {
        return await list(ctx, body)
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
