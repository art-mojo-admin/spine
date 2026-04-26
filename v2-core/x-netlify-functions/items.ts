import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List items
export const list = createHandler(async (ctx, body) => {
  const { item_type, app_id, include_inactive, limit = 50, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('items')
    .select('*')
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })
    .range(parseInt(offset.toString()), parseInt(offset.toString()) + parseInt(limit.toString()) - 1)

  if (item_type) {
    query = query.eq('item_type', item_type)
  }

  if (app_id) {
    query = query.eq('app_id', app_id)
  }

  if (include_inactive !== 'true') {
    query = query.eq('is_active', true)
  }

  const { data, error: err } = await query

  if (err) throw err

  return data
})

// Get single item
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}
  
  if (!id) {
    throw new Error('Item ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_item_with_schema', { item_id: id })

  if (err) throw err

  return data
})

// Create item
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, item_type, title, description, data, metadata } = body

  if (!item_type || !title) {
    throw new Error('item_type and title are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // Validate item data against type schema
  const { data: isValid } = await db
    .rpc('validate_item_data', {
      item_type,
      data: data || {},
      app_id: app_id || null
    })

  if (!isValid) {
    throw new Error('Invalid item data for type')
  }

  const { data: item, error: err } = await db
    .from('items')
    .insert({
      app_id,
      item_type,
      title,
      description,
      data: data || {},
      metadata: metadata || {},
      status: 'active',
      is_active: true,
      created_by: ctx.personId,
      account_id: ctx.accountId
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'item.created', { type: 'item', id: item.id }, { after: item })

  return item
}))

// Update item
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, data, metadata, status } = body

  if (!id) {
    throw new Error('Item ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('items')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Item not found')
  }

  // Validate new data if provided
  if (data !== undefined) {
    const { data: isValid } = await db
      .rpc('validate_item_data', {
        item_type: current.item_type,
        data,
        app_id: current.app_id
      })

    if (!isValid) {
      throw new Error('Invalid item data for type')
    }
  }

  const updates: any = {}
  if (data !== undefined) updates.data = data
  if (metadata !== undefined) updates.metadata = metadata
  if (status !== undefined) {
    updates.status = status
    updates.is_active = status === 'active'
  }
  updates.updated_at = new Date().toISOString()

  const { data: item, error: err } = await db
    .from('items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'item.updated', { type: 'item', id }, { before: current, after: item })

  return item
}))

// Delete item (soft delete)
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Item ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('items')
    .select('*')
    .eq('id', id)
    .single()

  if (!current) {
    throw new Error('Item not found')
  }

  const { data, error: err } = await db
    .rpc('soft_delete_item', { item_id: id })

  if (err) throw err

  await emitLog(ctx, 'item.deleted', { type: 'item', id }, { before: current })

  return { success: data }
}))

// Archive item
export const archive = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Item ID is required')
  }

  const { data, error: err } = await db
    .rpc('archive_item', { item_id: id })

  if (err) throw err

  await emitLog(ctx, 'item.archived', { type: 'item', id }, { after: { status: 'archived' } })

  return { success: data }
}))

// Search items
export const search = createHandler(async (ctx, body) => {
  const { query, item_types, app_id, limit = 50, offset = 0 } = ctx.query || {}

  if (!query) {
    throw new Error('Search query is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('search_items', {
      account_id: ctx.accountId,
      query,
      item_types: item_types ? item_types.split(',') : null,
      app_id: app_id || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.id) {
        return await get(ctx, body)
      } else if (ctx.query?.action === 'search') {
        return await search(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      if (ctx.query?.action === 'archive') {
        return await archive(ctx, body)
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
