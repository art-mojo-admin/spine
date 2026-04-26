import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List people
export const list = createHandler(async (ctx, body) => {
  const { type_id, status, limit = 50, offset = 0 } = ctx.query || {}

  let query = db
    .from('people')
    .select(`
      *,
      type:types(id, slug, name, icon, color)
    `)
    .eq('is_active', true)
    .order('full_name')

  if (type_id) {
    query = query.eq('type_id', type_id)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error: err } = await query
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (err) throw err

  return data
})

// Get single person
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Person ID is required')
  }

  const { data, error: err } = await db
    .from('people')
    .select(`
      *,
      type:types(id, slug, name, icon, color)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  return data
})

// Create person
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { type_id, auth_uid, full_name, email, phone, avatar_url, metadata } = body

  if (!full_name || !email) {
    throw new Error('full_name and email are required')
  }

  // Check if email already exists
  const { data: existing } = await db
    .from('people')
    .select('id')
    .eq('email', email)
    .single()

  if (existing) {
    throw new Error('Person with this email already exists')
  }

  const { data, error: err } = await db
    .from('people')
    .insert({
      type_id,
      auth_uid,
      full_name,
      email,
      phone,
      avatar_url,
      metadata: metadata || {},
      status: 'active',
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'person.created', { type: 'person', id: data.id }, { after: data })

  return data
}))

// Update person
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, ...updates } = body

  if (!id) {
    throw new Error('Person ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('people')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Person not found')
  }

  const { data, error: err } = await db
    .from('people')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'person.updated', { type: 'person', id }, { before: current, after: data })

  return data
}))

// Soft delete person
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Person ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('people')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Person not found')
  }

  const { data, error: err } = await db
    .from('people')
    .update({
      is_active: false,
      status: 'inactive',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'person.deleted', { type: 'person', id }, { before: current })

  return data
}))

// Get or create person from auth
export const getOrCreate = createHandler(async (ctx, body) => {
  const { auth_uid, email, full_name } = body

  if (!auth_uid || !email || !full_name) {
    throw new Error('auth_uid, email, and full_name are required')
  }

  const { data, error: err } = await db
    .rpc('get_or_create_person', {
      auth_uid,
      email,
      full_name
    })

  if (err) throw err

  return { person_id: data }
})

// Main handler function
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
      if (ctx.query?.action === 'getOrCreate') {
        return await getOrCreate(ctx, body)
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
