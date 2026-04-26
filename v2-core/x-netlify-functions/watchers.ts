import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Add watcher
export const add = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id, watch_type, notification_settings, metadata } = body

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('add_watcher', {
      target_type,
      target_id,
      person_id: ctx.personId!,
      watch_type: watch_type || 'all',
      notification_settings: notification_settings || {},
      metadata: metadata || {}
    })

  if (err) throw err

  await emitLog(ctx, 'watcher.added', 
    { type: 'watcher', id: data }, 
    { after: { target_type, target_id, person_id: ctx.personId } }
  )

  return { watcher_id: data }
}))

// Remove watcher
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id } = body

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('remove_watcher', {
      target_type,
      target_id,
      person_id: ctx.personId!
    })

  if (err) throw err

  await emitLog(ctx, 'watcher.removed', 
    { type: 'watcher', id: `${target_type}-${target_id}-${ctx.personId}` }, 
    { before: { target_type, target_id, person_id: ctx.personId } }
  )

  return { success: data }
}))

// Get watchers for target
export const getTargetWatchers = createHandler(async (ctx, body) => {
  const { target_type, target_id, watch_type, include_inactive } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('get_watchers', {
      target_type,
      target_id,
      watch_type: watch_type || null,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// Get person's watches
export const getPersonWatches = createHandler(async (ctx, body) => {
  const { target_type, include_inactive } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('get_person_watches', {
      person_id: ctx.personId!,
      target_type: target_type || null,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// Check if watching
export const check = createHandler(async (ctx, body) => {
  const { target_type, target_id, watch_type } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('is_watching', {
      person_id: ctx.personId!,
      target_type,
      target_id,
      watch_type: watch_type || null
    })

  if (err) throw err

  return { is_watching: data }
})

// Update notification settings
export const updateSettings = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id, notification_settings } = body

  if (!target_type || !target_id || !notification_settings) {
    throw new Error('target_type, target_id, and notification_settings are required')
  }

  const { data, error: err } = await db
    .rpc('update_notification_settings', {
      target_type,
      target_id,
      person_id: ctx.personId!,
      notification_settings
    })

  if (err) throw err

  await emitLog(ctx, 'watcher.settings_updated', 
    { type: 'watcher', id: `${target_type}-${target_id}-${ctx.personId}` }, 
    { after: { notification_settings } }
  )

  return { success: data }
}))

// Deactivate watcher
export const deactivate = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id } = body

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('deactivate_watcher', {
      target_type,
      target_id,
      person_id: ctx.personId!
    })

  if (err) throw err

  await emitLog(ctx, 'watcher.deactivated', 
    { type: 'watcher', id: `${target_type}-${target_id}-${ctx.personId}` }, 
    { after: { is_active: false } }
  )

  return { success: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'target-watchers':
      if (method === 'GET') {
        return await getTargetWatchers(ctx, body)
      }
      break
    case 'person-watches':
      if (method === 'GET') {
        return await getPersonWatches(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await check(ctx, body)
      }
      break
    case 'settings':
      if (method === 'PATCH') {
        return await updateSettings(ctx, body)
      }
      break
    case 'deactivate':
      if (method === 'POST') {
        return await deactivate(ctx, body)
      }
      break
    default:
      if (method === 'POST') {
        return await add(ctx, body)
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
