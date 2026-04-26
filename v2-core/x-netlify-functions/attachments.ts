import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Create attachment record
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id, filename, content_type, size_bytes, storage_path, storage_provider, metadata } = body

  if (!target_type || !target_id || !filename || !content_type || !size_bytes || !storage_path) {
    throw new Error('target_type, target_id, filename, content_type, size_bytes, and storage_path are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_attachment', {
      target_type,
      target_id,
      filename,
      content_type,
      size_bytes,
      storage_path,
      storage_provider: storage_provider || 'supabase',
      metadata: metadata || {},
      uploaded_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'attachment.created', 
    { type: 'attachment', id: data }, 
    { after: { target_type, target_id, filename, size_bytes } }
  )

  return { attachment_id: data }
}))

// Get attachments for target
export const getTargetAttachments = createHandler(async (ctx, body) => {
  const { target_type, target_id, content_type, limit = 50, offset = 0 } = ctx.query || {}

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_attachments', {
      target_type,
      target_id,
      account_id: ctx.accountId,
      content_type: content_type || null,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    })

  if (err) throw err

  return data
})

// Get attachment details
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Attachment ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_attachment', { attachment_id: id })

  if (err) throw err

  return data
})

// Delete attachment
export const remove = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Attachment ID is required')
  }

  // Get current state for audit
  const { data: current } = await db
    .rpc('get_attachment', { attachment_id: id })

  if (!current) {
    throw new Error('Attachment not found')
  }

  const { data, error: err } = await db
    .rpc('delete_attachment', { attachment_id: id })

  if (err) throw err

  await emitLog(ctx, 'attachment.deleted', 
    { type: 'attachment', id }, 
    { before: current }
  )

  return { success: data }
}))

// Update attachment metadata
export const updateMetadata = requireAuth(createHandler(async (ctx, body) => {
  const { id, metadata } = body

  if (!id || !metadata) {
    throw new Error('Attachment ID and metadata are required')
  }

  const { data, error: err } = await db
    .rpc('update_attachment_metadata', {
      attachment_id: id,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'attachment.metadata_updated', 
    { type: 'attachment', id }, 
    { after: { metadata } }
  )

  return { success: data }
}))

// Get attachment statistics
export const getStats = createHandler(async (ctx, body) => {
  const { target_type } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_attachment_stats', {
      account_id: ctx.accountId,
      target_type: target_type || null
    })

  if (err) throw err

  return data
})

// Check if attachment exists
export const check = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Attachment ID is required')
  }

  const { data, error: err } = await db
    .rpc('attachment_exists', { attachment_id: id })

  if (err) throw err

  return { exists: data }
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'target-attachments':
      if (method === 'GET') {
        return await getTargetAttachments(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await check(ctx, body)
      }
      break
    case 'metadata':
      if (method === 'PATCH') {
        return await updateMetadata(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.id) {
        return await get(ctx, body)
      } else if (method === 'POST') {
        return await create(ctx, body)
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
