import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List thread participants
export const list = createHandler(async (ctx, body) => {
  const { thread_id, include_inactive, role_filter } = ctx.query || {}

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
    .rpc('get_thread_participants', {
      thread_id,
      include_inactive: include_inactive === 'true',
      role_filter: role_filter || null
    })

  if (err) throw err

  return data
})

// Add participant to thread
export const add = requireAuth(createHandler(async (ctx, body) => {
  const { thread_id, person_id, role, notification_settings, metadata } = body

  if (!thread_id || !person_id) {
    throw new Error('thread_id and person_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('add_thread_participant', {
      thread_id,
      person_id,
      role: role || 'member',
      notification_settings: notification_settings || {},
      metadata: metadata || {},
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'thread_participant.added', 
    { type: 'thread_participant', id: data }, 
    { after: { thread_id, person_id, role } }
  )

  return { participant_id: data }
}))

// Remove participant from thread
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { thread_id, person_id } = body

  if (!thread_id || !person_id) {
    throw new Error('thread_id and person_id are required')
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
    .rpc('remove_thread_participant', {
      thread_id,
      person_id
    })

  if (err) throw err

  await emitLog(ctx, 'thread_participant.removed', 
    { type: 'thread_participant', id: `${thread_id}-${person_id}` }, 
    { before: { thread_id, person_id } }
  )

  return { success: data }
}))

// Update participant role
export const updateRole = requireAuth(createHandler(async (ctx, body) => {
  const { thread_id, person_id, new_role } = body

  if (!thread_id || !person_id || !new_role) {
    throw new Error('thread_id, person_id, and new_role are required')
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
    .rpc('update_participant_role', {
      thread_id,
      person_id,
      new_role
    })

  if (err) throw err

  await emitLog(ctx, 'thread_participant.role_updated', 
    { type: 'thread_participant', id: `${thread_id}-${person_id}` }, 
    { after: { role: new_role } }
  )

  return { success: data }
}))

// Update notification settings
export const updateNotifications = requireAuth(createHandler(async (ctx, body) => {
  const { thread_id, notification_settings } = body

  if (!thread_id || !notification_settings) {
    throw new Error('thread_id and notification_settings are required')
  }

  const { data, error: err } = await db
    .rpc('update_participant_notifications', {
      thread_id,
      person_id: ctx.personId!,
      notification_settings
    })

  if (err) throw err

  await emitLog(ctx, 'thread_participant.notifications_updated', 
    { type: 'thread_participant', id: `${thread_id}-${ctx.personId}` }, 
    { after: { notification_settings } }
  )

  return { success: data }
}))

// Check if person is participant
export const check = createHandler(async (ctx, body) => {
  const { thread_id, role_filter } = ctx.query || {}

  if (!thread_id) {
    throw new Error('Thread ID is required')
  }

  const { data, error: err } = await db
    .rpc('is_thread_participant', {
      thread_id,
      person_id: ctx.personId!,
      role_filter: role_filter || null
    })

  if (err) throw err

  return { is_participant: data }
})

// Get participant statistics
export const getStats = createHandler(async (ctx, body) => {
  const { thread_id } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_participant_statistics', {
      thread_id: thread_id || null,
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
    case 'notifications':
      if (method === 'PATCH') {
        return await updateNotifications(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        return await list(ctx, body)
      } else if (method === 'POST') {
        return await add(ctx, body)
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      } else if (method === 'PATCH') {
        return await updateRole(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
