import { createHandler } from './_shared/middleware'
import { sanitizeRecordData } from './_shared/permissions'
import { adminDb } from './_shared/db'

const PERMISSIONS_ALL = {
  record_permissions: { all: ['create', 'read', 'update', 'delete'] },
  fields: {}
}

// Valid runtime entities for admin data operations
const VALID_ENTITIES = ['accounts', 'people', 'items', 'threads', 'messages', 'links', 'attachments', 'watchers']

// List all records for an entity with filtering, sorting, pagination
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
      query = query.eq('item_type_id', typeRecord.id)
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

// Get single record by ID
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

// Create new record
export const create = createHandler(async (ctx, body) => {
  const { entity, ...recordData } = body

  if (!entity || !VALID_ENTITIES.includes(entity)) {
    throw new Error('Valid entity parameter is required')
  }

  // type_id is required on all runtime record creation
  if (!recordData.type_id) {
    throw new Error('type_id is required — every runtime record must reference a type')
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

  return await sanitizeRecordData(ctx, data, entity)
})

// Update existing record
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

  return await sanitizeRecordData(ctx, data, entity)
})

// Delete record (hard or soft)
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

// Helper function to get search field based on entity
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

// Helper function to check if entity supports soft delete
function entitySupportsSoftDelete(entity: string): boolean {
  const softDeleteEntities = ['accounts', 'people', 'items', 'threads', 'messages', 'watchers']
  return softDeleteEntities.includes(entity)
}

// Get stats for entity
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

// Main handler function
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
