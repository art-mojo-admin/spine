import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List embeddings
export const list = createHandler(async (ctx, body) => {
  const { target_type, target_id, embedding_model, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('embeddings')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (target_type) {
    query = query.eq('target_type', target_type)
  }
  if (target_id) {
    query = query.eq('target_id', target_id)
  }
  if (embedding_model) {
    query = query.eq('embedding_model', embedding_model)
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Get single embedding
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Embedding ID is required')
  }

  const { data, error: err } = await db
    .from('embeddings')
    .select(`
      *,
      app:apps(id, slug, name)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create embedding
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, target_type, target_id, content, embedding_model, metadata } = body

  if (!target_type || !target_id || !content) {
    throw new Error('target_type, target_id, and content are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_embedding', {
      app_id,
      target_type,
      target_id,
      content,
      embedding_model: embedding_model || 'text-embedding-ada-002',
      metadata: metadata || {},
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'embedding.created', 
    { type: 'embedding', id: data }, 
    { after: { target_type, target_id } }
  )

  return { embedding_id: data }
}))

// Update embedding
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, content, metadata } = body

  if (!id) {
    throw new Error('Embedding ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_embedding', {
      embedding_id: id,
      content,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'embedding.updated', 
    { type: 'embedding', id }, 
    { after: { content_updated: !!content } }
  )

  return { success: data }
}))

// Search similar embeddings
export const searchSimilar = createHandler(async (ctx, body) => {
  const { query_vector, target_type, app_id, limit, similarity_threshold } = body

  if (!query_vector) {
    throw new Error('query_vector is required')
  }

  const { data, error: err } = await db
    .rpc('search_similar_embeddings', {
      query_vector,
      target_type: target_type || null,
      app_id: app_id || null,
      limit: limit || 10,
      similarity_threshold: similarity_threshold || 0.7
    })

  if (err) throw err

  return data
})

// Search embeddings by content
export const searchByContent = createHandler(async (ctx, body) => {
  const { query_text, target_type, app_id, limit } = body

  if (!query_text) {
    throw new Error('query_text is required')
  }

  const { data, error: err } = await db
    .rpc('search_embeddings_by_content', {
      query_text,
      target_type: target_type || null,
      app_id: app_id || null,
      limit: limit || 10
    })

  if (err) throw err

  return data
})

// Get embedding statistics
export const getStats = createHandler(async (ctx, body) => {
  const { app_id } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_embedding_statistics', {
      account_id: ctx.accountId,
      app_id: app_id || null
    })

  if (err) throw err

  return data
})

// Batch create embeddings
export const batchCreate = requireAuth(createHandler(async (ctx, body) => {
  const { embeddings_data, app_id, embedding_model } = body

  if (!embeddings_data || !Array.isArray(embeddings_data)) {
    throw new Error('embeddings_data array is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('batch_create_embeddings', {
      embeddings_data,
      app_id,
      embedding_model: embedding_model || 'text-embedding-ada-002',
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'embeddings.batch_created', 
    { type: 'system', id: 'batch_create' }, 
    { after: { batch_size: embeddings_data.length } }
  )

  return data
}))

// Delete embeddings for target
export const deleteTarget = requireAuth(createHandler(async (ctx, body) => {
  const { target_type, target_id, app_id } = body

  if (!target_type || !target_id) {
    throw new Error('target_type and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('delete_target_embeddings', {
      target_type,
      target_id,
      app_id: app_id || null
    })

  if (err) throw err

  await emitLog(ctx, 'embeddings.target_deleted', 
    { type: 'system', id: 'target_delete' }, 
    { after: { target_type, target_id, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Reindex embeddings
export const reindex = requireAuth(createHandler(async (ctx, body) => {
  const { embedding_model, target_type, app_id, batch_size } = body

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('reindex_embeddings', {
      embedding_model: embedding_model || 'text-embedding-ada-002',
      target_type: target_type || null,
      app_id: app_id || null,
      batch_size: batch_size || 100
    })

  if (err) throw err

  await emitLog(ctx, 'embeddings.reindexed', 
    { type: 'system', id: 'batch_reindex' }, 
    { after: { embedding_model, processed_count: data[0]?.processed_count } }
  )

  return data
}))

// Cleanup old embeddings
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep } = body

  const { data, error: err } = await db
    .rpc('cleanup_embeddings', {
      days_to_keep: days_to_keep || 365
    })

  if (err) throw err

  await emitLog(ctx, 'embeddings.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 365, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'search-similar':
      if (method === 'POST') {
        return await searchSimilar(ctx, body)
      }
      break
    case 'search-content':
      if (method === 'POST') {
        return await searchByContent(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'batch-create':
      if (method === 'POST') {
        return await batchCreate(ctx, body)
      }
      break
    case 'delete-target':
      if (method === 'POST') {
        return await deleteTarget(ctx, body)
      }
      break
    case 'reindex':
      if (method === 'POST') {
        return await reindex(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
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
      }
  }

  throw new Error('Invalid action or method')
})
