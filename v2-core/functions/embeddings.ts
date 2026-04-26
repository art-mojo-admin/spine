import { createHandler } from './_shared/middleware'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// List embeddings - RLS enforced
export const list = createHandler(async (ctx, _body) => {
  const { model_id, document_id, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('embeddings')
    .select('*')
    .order('created_at', { ascending: false })

  if (model_id) {
    query = query.eq('model_id', model_id)
  }
  if (document_id) {
    query = query.eq('document_id', document_id)
  }

  const parsedOffset = parseInt(offset.toString())
  const parsedLimit = parseInt(limit.toString())

  const { data, error: err } = await query.range(
    parsedOffset,
    parsedOffset + parsedLimit - 1
  )

  if (err) throw err

  const sanitized = []
  for (const embedding of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, embedding, 'embedding'))
  }

  return sanitized
})

// Get single embedding
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Embedding ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('embeddings')
    .select('*')
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'embedding')
})

// Create embedding - RLS enforced
export const create = createHandler(async (ctx, body) => {
  const { model_id, document_id, chunk_index, content, metadata } = body

  if (!model_id || !document_id || !content) {
    throw new Error('model_id, document_id, and content are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('embeddings')
    .insert({
      model_id,
      document_id,
      chunk_index: chunk_index || 0,
      content,
      metadata: metadata || {},
      account_id: ctx.accountId
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'embedding.created', 
    { type: 'embedding', id: data.id }, 
    { after: { document_id, model_id } }
  )

  return data
})

// Update embedding - RLS enforced
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, content, metadata } = body || {}

  if (!id) {
    throw new Error('Embedding ID is required')
  }

  const updateFields: Record<string, any> = {}
  if (content !== undefined) updateFields.content = content
  if (metadata !== undefined) updateFields.metadata = metadata

  const { data, error: err } = await ctx.db
    .from('embeddings')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'embedding.updated', 
    { type: 'embedding', id }, 
    { after: { content_updated: !!content } }
  )

  return data
})

// Get embedding statistics - RLS enforced
export const getStats = createHandler(async (ctx, _body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { count, error: err } = await ctx.db
    .from('embeddings')
    .select('*', { count: 'exact', head: true })

  if (err) throw err

  return { total_embeddings: count || 0 }
})

// Batch create embeddings - RLS enforced
export const batchCreate = createHandler(async (ctx, body) => {
  const { embeddings_data } = body

  if (!embeddings_data || !Array.isArray(embeddings_data)) {
    throw new Error('embeddings_data array is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const rows = embeddings_data.map((e: any) => ({
    ...e,
    account_id: ctx.accountId
  }))

  const { data, error: err } = await ctx.db
    .from('embeddings')
    .insert(rows)
    .select()

  if (err) throw err

  await emitLog(ctx, 'embeddings.batch_created', 
    { type: 'system', id: 'batch_create' }, 
    { after: { batch_size: embeddings_data.length } }
  )

  return data
})

// Delete embeddings by document - RLS enforced
export const deleteByDocument = createHandler(async (ctx, body) => {
  const { document_id } = body

  if (!document_id) {
    throw new Error('document_id is required')
  }

  const { data, error: err } = await ctx.db
    .from('embeddings')
    .delete()
    .eq('document_id', document_id)
    .select()

  if (err) throw err

  await emitLog(ctx, 'embeddings.document_deleted', 
    { type: 'system', id: 'document_delete' }, 
    { after: { document_id, deleted_count: data?.length || 0 } }
  )

  return { deleted_count: data?.length || 0 }
})

// Cleanup old embeddings - RLS enforced
export const cleanup = createHandler(async (ctx, body) => {
  const { days_to_keep } = body
  const daysToKeep = days_to_keep || 365

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  const { data, error: err } = await ctx.db
    .from('embeddings')
    .delete()
    .lt('created_at', cutoff.toISOString())
    .select()

  if (err) throw err

  await emitLog(ctx, 'embeddings.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: daysToKeep, deleted_count: data?.length || 0 } }
  )

  return { deleted_count: data?.length || 0 }
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
    case 'batch-create':
      if (method === 'POST') {
        return await batchCreate(ctx, body)
      }
      break
    case 'delete-document':
      if (method === 'POST') {
        return await deleteByDocument(ctx, body)
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
