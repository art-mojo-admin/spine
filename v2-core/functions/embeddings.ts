/**
 * @module embeddings
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * CRUD and search API for the `embeddings` table. Embeddings store vector
 * representations of text chunks for RAG (retrieval-augmented generation)
 * workloads. Vector similarity search is performed via the
 * `search_similar_embeddings` Postgres RPC function.
 *
 * **Routed by:** `GET/POST/PATCH /.netlify/functions/embeddings`
 *
 * **Actions:**
 * | method | ?action         | handler           |
 * |--------|-----------------|-------------------|
 * | GET    | stats           | getStats          |
 * | POST   | batch-create    | batchCreate       |
 * | POST   | delete-document | deleteByDocument  |
 * | POST   | cleanup         | cleanup           |
 * | POST   | search-similar  | searchSimilar     |
 * | POST   | search-semantic | searchSemantic    |
 * | GET    | ?id             | get               |
 * | GET    | (default)       | list              |
 * | POST   | —               | create            |
 * | PATCH  | —               | update            |
 *
 * **Authorization:** All operations use `ctx.db` (RLS-scoped). Account context
 * required for writes. No hard-delete endpoint — use `delete-document` or
 * `cleanup` for bulk removal.
 *
 * INVARIANT: `update` only patches `content` and `metadata`.
 * INVARIANT: `searchSimilar` requires a pre-computed `query_embedding` vector.
 *   Use `searchSemantic` for text-based fallback.
 *
 * @seeAlso agent-runner.ts (executeSearchKnowledge calls search_similar_embeddings)
 * @seeAlso pipeline-runner.ts (search_knowledge stage type)
 * @seeAlso audit.ts (emitLog for embedding.* / embeddings.* events)
 */

import { createHandler } from './_shared/middleware'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Lists embeddings for the account with optional filtering.
 *
 * Query params: `model_id`, `document_id`,
 * `limit` (default 100), `offset` (default 0)
 *
 * @returns Sanitized embedding records ordered by created_at desc
 * @throws Error('Account context required')
 * @sideEffects DB read: embeddings table
 * @calledBy handler (GET, no id)
 */
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

/**
 * Returns a single embedding by UUID.
 *
 * Query params: `id` (required)
 *
 * @returns Sanitized embedding record
 * @throws Error('Embedding ID is required')
 * @throws PostgREST error if not found or RLS denied
 * @sideEffects DB read: embeddings table
 * @calledBy handler (GET ?id)
 */
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

/**
 * Creates a single embedding record. Authenticated principal required.
 * Audit logged on success.
 *
 * Body: `model_id`, `document_id`, `content` (all required), plus optional
 * `chunk_index` (default 0), `metadata`
 *
 * @returns Inserted embedding record
 * @throws Error('model_id, document_id, and content are required')
 * @inputSpec content: string — raw text chunk; vector generation happens externally
 * @inputSpec chunk_index: number — 0-based position within document
 * @sideEffects DB write: embeddings table (INSERT)
 * @sideEffects audit: emitLog('embedding.created')
 * @calledBy handler (POST)
 */
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

/**
 * Updates an embedding's `content` and/or `metadata`. Audit logged.
 *
 * Body/query: `id` (required), plus `content` and/or `metadata`
 *
 * @returns Updated embedding record
 * @throws Error('Embedding ID is required')
 * @sideEffects DB write: embeddings table (UPDATE)
 * @sideEffects audit: emitLog('embedding.updated')
 * @calledBy handler (PATCH)
 */
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

/**
 * Returns total embedding count for the account (RLS-scoped).
 *
 * @returns `{ total_embeddings: number }`
 * @throws Error('Account context required')
 * @sideEffects DB read: embeddings table (count only)
 * @calledBy handler (GET ?action=stats)
 */
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

/**
 * Batch-inserts multiple embeddings in a single DB round-trip.
 * Stamps `account_id` on each row. Audit logged.
 *
 * Body: `embeddings_data` (required, array of embedding objects)
 *
 * @returns Array of inserted embedding records
 * @throws Error('embeddings_data array is required')
 * @throws Error('Account context required')
 * @inputSpec embeddings_data: Array<{model_id, document_id, chunk_index, content, metadata}>
 * @sideEffects DB write: embeddings table (INSERT, bulk)
 * @sideEffects audit: emitLog('embeddings.batch_created', { batch_size })
 * @calledBy handler (POST ?action=batch-create)
 */
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

/**
 * Deletes all embeddings for a given document_id. Used when a knowledge
 * document is re-indexed or removed. Audit logged.
 *
 * Body: `document_id` (required)
 *
 * @returns `{ deleted_count: number }`
 * @throws Error('document_id is required')
 * @sideEffects DB write: embeddings table (DELETE WHERE document_id=)
 * @sideEffects audit: emitLog('embeddings.document_deleted')
 * @calledBy handler (POST ?action=delete-document)
 */
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

/**
 * Deletes embeddings older than `days_to_keep` (default 365). Audit logged.
 * Scoped by RLS (only deletes accessible embeddings).
 *
 * Body: `days_to_keep` (optional, default 365)
 *
 * @returns `{ deleted_count: number }`
 * @sideEffects DB write: embeddings table (DELETE WHERE created_at < cutoff)
 * @sideEffects audit: emitLog('embeddings.cleaned')
 * @calledBy handler (POST ?action=cleanup)
 */
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

/**
 * Searches for semantically similar embeddings using vector cosine similarity
 * via the `search_similar_embeddings` RPC. Requires a pre-computed embedding
 * vector for the query.
 *
 * Body: `query_embedding` (required, number[]), `model_id` (default
 * 'text-embedding-ada-002'), `limit` (default 10), `threshold` (default 0.7)
 *
 * @returns `{ results, count, model_id, threshold }`
 * @throws Error('Account context required')
 * @throws Error('query_embedding is required for similarity search')
 * @inputSpec query_embedding: number[] — dense vector from embedding model
 * @inputSpec threshold: number — 0–1 minimum cosine similarity score
 * @sideEffects DB read: search_similar_embeddings RPC
 * @calledBy handler (POST ?action=search-similar)
 * @calledBy agent-runner.ts executeSearchKnowledge
 */
export const searchSimilar = createHandler(async (ctx, body) => {
  const { query_embedding, model_id, limit = 10, threshold = 0.7 } = body || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  if (!query_embedding) {
    throw new Error('query_embedding is required for similarity search')
  }

  // Call the RPC function for vector similarity search
  const { data, error: err } = await ctx.db.rpc('search_similar_embeddings', {
    p_account_id: ctx.accountId,
    p_model_id: model_id || 'text-embedding-ada-002',
    p_query_embedding: query_embedding,
    p_limit: parseInt(limit.toString()),
    p_threshold: parseFloat(threshold.toString())
  })

  if (err) throw err

  return {
    results: data || [],
    count: data?.length || 0,
    model_id: model_id || 'text-embedding-ada-002',
    threshold: parseFloat(threshold.toString())
  }
})

/**
 * Performs full-text search on embedding content using Postgres `websearch`
 * ts_vector. Fallback for when no query embedding is available.
 *
 * Body: `query` (required), `model_id` (optional filter), `document_ids`
 * (optional array filter), `limit` (default 10)
 *
 * @returns `{ results, count, method: 'text_search', query }`
 * @throws Error('Account context required')
 * @throws Error('query is required for semantic search')
 * @sideEffects DB read: embeddings table (full-text search)
 * @calledBy handler (POST ?action=search-semantic)
 */
export const searchSemantic = createHandler(async (ctx, body) => {
  const { query, model_id, document_ids, limit = 10 } = body || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  if (!query) {
    throw new Error('query is required for semantic search')
  }

  let dbQuery = ctx.db
    .from('embeddings')
    .select('*')
    .eq('account_id', ctx.accountId)
    .textSearch('content', query, {
      type: 'websearch',
      config: 'english'
    })
    .limit(parseInt(limit.toString()))

  if (model_id) {
    dbQuery = dbQuery.eq('model_id', model_id)
  }

  if (document_ids && Array.isArray(document_ids) && document_ids.length > 0) {
    dbQuery = dbQuery.in('document_id', document_ids)
  }

  const { data, error: err } = await dbQuery

  if (err) throw err

  return {
    results: data || [],
    count: data?.length || 0,
    method: 'text_search',
    query
  }
})

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

/**
 * Netlify function entry point. See module dispatch table for full routing.
 * @throws Error('Invalid action or method') on unmatched combination
 * @calledBy Netlify function routing
 */
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
    case 'search-similar':
      if (method === 'POST') {
        return await searchSimilar(ctx, body)
      }
      break
    case 'search-semantic':
      if (method === 'POST') {
        return await searchSemantic(ctx, body)
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
