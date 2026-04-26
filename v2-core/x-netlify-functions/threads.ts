import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List threads for target
export const listTarget = createHandler(async (ctx, body) => {
  const { target_type, target_id, visibility, include_inactive, limit = 50, offset = 0 } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_target_threads', {
      target_type,
      target_id,
      account_id: ctx.accountId,
      visibility: visibility || null,
      include_inactive: include_inactive === 'true',
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// List person's threads
export const listPerson = createHandler(async (ctx, body) => {
  const { include_inactive, limit = 50, offset = 0 } = ctx.query || {}

  const { data, error: err } = await db
    .rpc('get_person_threads', {
      person_id: ctx.personId!,
      account_id: ctx.accountId!,
      include_inactive: include_inactive === 'true',
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Get single thread
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Thread ID is required')
  }

  // Check access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id: id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  const { data, error: err } = await db
    .from('threads')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create thread
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id, title, description, visibility, conversation_mode, metadata, app_id } = body

  if (!target_type || !target_id || !title) {
    throw new Error('target_type, target_id, and title are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_thread', {
      target_type,
      target_id,
      title,
      description,
      visibility: visibility || 'team',
      conversation_mode: conversation_mode || 'human',
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId,
      app_id: app_id || null
    })

  if (err) throw err

  await emitLog(ctx, 'thread.created', 
    { type: 'thread', id: data }, 
    { after: { target_type, target_id, title } }
  )

  return { thread_id: data }
}))

// Update thread status
export const updateStatus = requireAuth(createHandler(async (ctx, body) => {
  const { id, status } = body

  if (!id || !status) {
    throw new Error('Thread ID and status are required')
  }

  // Check access
  const { data: canAccess } = await db
    .rpc('can_access_thread', {
      thread_id: id,
      person_id: ctx.personId!
    })

  if (!canAccess) {
    throw new Error('Access denied')
  }

  const { data, error: err } = await db
    .rpc('update_thread_status', {
      thread_id: id,
      new_status: status
    })

  if (err) throw err

  await emitLog(ctx, 'thread.status_updated', 
    { type: 'thread', id }, 
    { after: { status } }
  )

  return { success: data }
}))

// Check thread access
export const checkAccess = createHandler(async (ctx, body) => {
  const { thread_id } = ctx.query || {}

  if (!thread_id) {
    throw new Error('Thread ID is required')
  }

  const { data, error: err } = await db
    .rpc('can_access_thread', {
      thread_id,
      person_id: ctx.personId!
    })

  if (err) throw err

  return { can_access: data }
})

// Create welcome thread
export const createWelcome = requireAuth(createHandler(async (ctx, body) => {
  const { person_id } = body

  if (!person_id) {
    throw new Error('Person ID is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_welcome_thread', {
      person_id,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'thread.welcome_created', 
    { type: 'thread', id: data }, 
    { after: { person_id } }
  )

  return { thread_id: data }
}))

// Create system thread
export const createSystem = requireAuth(createHandler(async (ctx, body) => {
  const { title, content } = body

  if (!title || !content) {
    throw new Error('Title and content are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_system_thread', {
      account_id: ctx.accountId,
      title,
      content
    })

  if (err) throw err

  await emitLog(ctx, 'thread.system_created', 
    { type: 'thread', id: data }, 
    { after: { title } }
  )

  return { thread_id: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'target':
      if (method === 'GET') {
        return await listTarget(ctx, body)
      }
      break
    case 'person':
      if (method === 'GET') {
        return await listPerson(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await checkAccess(ctx, body)
      }
      break
    case 'welcome':
      if (method === 'POST') {
        return await createWelcome(ctx, body)
      }
      break
    case 'system':
      if (method === 'POST') {
        return await createSystem(ctx, body)
      }
      break
    case 'status':
      if (method === 'PATCH') {
        return await updateStatus(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.id) {
        return await get(ctx, body)
      } else if (method === 'POST') {
        return await create(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
