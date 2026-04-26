import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Create link
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, link_type, direction, weight, metadata } = body

  if (!source_type || !source_id || !target_type || !target_id || !link_type) {
    throw new Error('source_type, source_id, target_type, target_id, and link_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // Validate link constraints
  const { data: isValid } = await db
    .rpc('validate_link_constraints', {
      source_type,
      source_id,
      target_type,
      target_id,
      link_type_slug: link_type,
      account_id: ctx.accountId
    })

  if (!isValid) {
    throw new Error('Link violates constraints')
  }

  const { data, error: err } = await db
    .rpc('create_link', {
      source_type,
      source_id,
      target_type,
      target_id,
      link_type,
      direction: direction || 'bidirectional',
      weight: weight || 1.0,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'link.created', 
    { type: 'link', id: data }, 
    { after: { source_type, source_id, target_type, target_id, link_type } }
  )

  return { link_id: data }
}))

// Get outgoing links
export const getOutgoing = createHandler(async (ctx, body) => {
  const { source_type, source_id, link_type } = ctx.query || {}

  if (!source_type || !source_id) {
    throw new Error('source_type and source_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_outgoing_links', {
      source_type,
      source_id,
      link_type: link_type || null,
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Get incoming links
export const getIncoming = createHandler(async (ctx, body) => {
  const { target_type, target_id, link_type } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_incoming_links', {
      target_type,
      target_id,
      link_type: link_type || null,
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Get related items
export const getRelated = createHandler(async (ctx, body) => {
  const { item_type, item_id, link_type } = ctx.query || {}

  if (!item_type || !item_id) {
    throw new Error('item_type and item_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_related_items', {
      item_type,
      item_id,
      link_type: link_type || null,
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Delete link
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, link_type } = body

  if (!source_type || !source_id || !target_type || !target_id || !link_type) {
    throw new Error('All link fields are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('delete_link', {
      source_type,
      source_id,
      target_type,
      target_id,
      link_type,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'link.deleted', 
    { type: 'link', id: `${source_type}-${source_id}-${target_type}-${target_id}-${link_type}` }, 
    { before: { source_type, source_id, target_type, target_id, link_type } }
  )

  return { success: data }
}))

// Check if link exists
export const check = createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, link_type } = ctx.query || {}

  if (!source_type || !source_id || !target_type || !target_id || !link_type) {
    throw new Error('All link fields are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('link_exists', {
      source_type,
      source_id,
      target_type,
      target_id,
      link_type,
      account_id: ctx.accountId
    })

  if (err) throw err

  return { exists: data }
})

// Get link statistics
export const getStats = createHandler(async (ctx, body) => {
  const { link_type } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_link_statistics', {
      account_id: ctx.accountId,
      link_type: link_type || null
    })

  if (err) throw err

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'outgoing':
      if (method === 'GET') {
        return await getOutgoing(ctx, body)
      }
      break
    case 'incoming':
      if (method === 'GET') {
        return await getIncoming(ctx, body)
      }
      break
    case 'related':
      if (method === 'GET') {
        return await getRelated(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await check(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    default:
      if (method === 'POST') {
        return await create(ctx, body)
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
