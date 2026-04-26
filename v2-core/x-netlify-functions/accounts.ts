import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List accounts
export const list = createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .from('accounts')
    .select(`
      *,
      type:types(id, slug, name, icon, color)
    `)
    .eq('is_active', true)
    .order('display_name')

  if (err) throw err

  return data
})

// Get single account
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Account ID is required')
  }

  const { data, error: err } = await db
    .from('accounts')
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

// Create account
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { type_id, slug, display_name, description, metadata, parent_id } = body

  if (!type_id || !slug || !display_name) {
    throw new Error('type_id, slug, and display_name are required')
  }

  // Check if slug is unique
  const { data: existing } = await db
    .from('accounts')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    throw new Error('Account slug already exists')
  }

  const { data, error: err } = await db
    .from('accounts')
    .insert({
      type_id,
      slug,
      display_name,
      description,
      metadata: metadata || {},
      parent_id,
      is_active: true
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'account.created', { type: 'account', id: data.id }, { after: data })

  return data
}))

// Update account
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, ...updates } = body

  if (!id) {
    throw new Error('Account ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Account not found')
  }

  const { data, error: err } = await db
    .from('accounts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'account.updated', { type: 'account', id }, { before: current, after: data })

  return data
}))

// Soft delete account
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Account ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Account not found')
  }

  const { data, error: err } = await db
    .from('accounts')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'account.deleted', { type: 'account', id }, { before: current })

  return data
}))

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
      return await create(ctx, body)
    case 'PATCH':
      return await update(ctx, body)
    case 'DELETE':
      return await remove(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
