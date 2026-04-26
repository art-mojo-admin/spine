import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List thread messages
export const list = createHandler(async (ctx, body) => {
  const { thread_id, visibility, limit = 100, offset = 0 } = ctx.query || {}

  if (!thread_id) {
    throw new Error('Thread ID is required')
  }

  // Check thread access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  const { data, error: err } = await db
    .rpc('get_thread_messages', {
      thread_id,
      account_id: ctx.accountId!,
      visibility: visibility || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Get single message
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Message ID is required')
  }

  // Get message and check thread access
  const { data, error: err } = await db
    .from('messages')
    .select(`
      *,
      thread:threads(id, target_type, target_id),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (err) throw err

  // Check thread access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id: data.thread_id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  return data
})

// Add message to thread
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { thread_id, content, direction, visibility, metadata } = body

  if (!thread_id || !content) {
    throw new Error('thread_id and content are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('add_message', {
      thread_id,
      content,
      direction: direction || 'outbound',
      visibility: visibility || 'all',
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  // Notify participants
  await db.rpc('notify_thread_participants', {
    thread_id,
    message_id: data,
    exclude_participant_id: ctx.personId
  })

  await emitLog(ctx, 'message.created', 
    { type: 'message', id: data }, 
    { after: { thread_id, content: content.substring(0, 100) } }
  )

  return { message_id: data }
}))

// Update message
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, content, metadata } = body

  if (!id) {
    throw new Error('Message ID is required')
  }

  // Get message and check thread access
  const { data: message } = await db
    .from('messages')
    .select('thread_id, created_by')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (!message) {
    throw new Error('Message not found')
  }

  // Check thread access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id: message.thread_id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  // Only allow updating own messages
  if (message.created_by !== ctx.personId) {
    throw new Error('Can only update own messages')
  }

  const { data, error: err } = await db
    .rpc('update_message', {
      message_id: id,
      content,
      metadata: metadata || null
    })

  if (err) throw err

  await emitLog(ctx, 'message.updated', 
    { type: 'message', id }, 
    { after: { content: content?.substring(0, 100) } }
  )

  return { success: data }
}))

// Delete message (soft delete)
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Message ID is required')
  }

  // Get message and check thread access
  const { data: message } = await db
    .from('messages')
    .select('thread_id, created_by')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (!message) {
    throw new Error('Message not found')
  }

  // Check thread access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id: message.thread_id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  // Only allow deleting own messages
  if (message.created_by !== ctx.personId) {
    throw new Error('Can only delete own messages')
  }

  const { data, error: err } = await db
    .rpc('delete_message', { message_id: id })

  if (err) throw err

  await emitLog(ctx, 'message.deleted', 
    { type: 'message', id }, 
    { before: { thread_id: message.thread_id } }
  )

  return { success: data }
}))

// Get message statistics
export const getStats = createHandler(async (ctx, body) => {
  const { thread_id, date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_message_statistics', {
      thread_id: thread_id || null,
      account_id: ctx.accountId,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Search messages
export const search = createHandler(async (ctx, body) => {
  const { query, thread_id, visibility, limit = 50, offset = 0 } = ctx.query || {}

  if (!query) {
    throw new Error('Search query is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('search_messages', {
      account_id: ctx.accountId,
      query,
      thread_id: thread_id || null,
      visibility: visibility || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Mark thread as read
export const markRead = requireAuth(createHandler(async (ctx, body) => {
  const { thread_id, up_to_sequence } = body

  if (!thread_id) {
    throw new Error('Thread ID is required')
  }

  // Check thread access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  const { error: err } = await db
    .rpc('mark_thread_read', {
      person_id: ctx.personId!,
      thread_id,
      up_to_sequence: up_to_sequence || null
    })

  if (err) throw err

  await emitLog(ctx, 'thread.marked_read', 
    { type: 'thread', id: thread_id }, 
    { after: { up_to_sequence } }
  )

  return { success: true }
}))

// Get unread message count
export const getUnreadCount = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_unread_message_count', {
      person_id: ctx.personId!,
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'search':
      if (method === 'GET') {
        return await search(ctx, body)
      }
      break
    case 'read':
      if (method === 'POST') {
        return await markRead(ctx, body)
      }
      break
    case 'unread':
      if (method === 'GET') {
        return await getUnreadCount(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        if (ctx.query?.id) {
          return await get(ctx, body)
        } else {
          return await list(ctx, body)
        }
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
