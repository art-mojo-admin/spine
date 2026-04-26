import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List types
export const list = createHandler(async (ctx, body) => {
  const { kind, app_id, ownership, limit = 50, offset = 0 } = ctx.query || {}

  let query = db
    .from('types')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('is_active', true)
    .order('kind, name')

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

  return data
})

// Get single type
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Type ID is required')
  }

  const { data, error: err } = await db
    .from('types')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  return data
})

// Get type schema
export const getSchema = createHandler(async (ctx, body) => {
  const { kind, slug, app_id } = ctx.query || {}

  if (!kind || !slug) {
    throw new Error('kind and slug are required')
  }

  const { data, error: err } = await db
    .rpc('get_type_schema', {
      kind,
      slug,
      app_id: app_id || null
    })

  if (err) throw err

  return { schema: data }
})

// Create type
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, kind, slug, name, description, icon, color, schema, ownership } = body

  if (!kind || !slug || !name) {
    throw new Error('kind, slug, and name are required')
  }

  // Check if slug is unique within app/kind
  let query = db
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

  // Validate schema
  const { data: valid } = await db
    .rpc('validate_type_schema', { schema: schema || {} })

  if (!valid) {
    throw new Error('Invalid schema structure')
  }

  const { data, error: err } = await db
    .from('types')
    .insert({
      app_id,
      kind,
      slug,
      name,
      description,
      icon,
      color,
      schema: schema || {},
      ownership: ownership || 'tenant',
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'type.created', { type: 'type', id: data.id }, { after: data })

  return data
}))

// Update type
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, ...updates } = body

  if (!id) {
    throw new Error('Type ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('types')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Type not found')
  }

  // Validate schema if provided
  if (updates.schema) {
    const { data: valid } = await db
      .rpc('validate_type_schema', { schema: updates.schema })

    if (!valid) {
      throw new Error('Invalid schema structure')
    }
  }

  const { data, error: err } = await db
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
}))

// Soft delete type
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Type ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('types')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Type not found')
  }

  const { data, error: err } = await db
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
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.id) {
        return await get(ctx, body)
      } else if (ctx.query?.action === 'schema') {
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
