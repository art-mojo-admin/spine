import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

function stubEmbed(text: string): number[] {
  const vec = new Array(1536).fill(0)
  for (let i = 0; i < text.length && i < 1536; i++) {
    vec[i] = (text.charCodeAt(i) % 100) / 100
  }
  return vec
}

export default createHandler({
  async POST(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const action = params.get('action')

    if (action === 'search') {
      const body = await parseBody<{
        query: string
        entity_type?: string
        vector_type?: string
        limit?: number
      }>(req)

      if (!body.query) return error('query required')

      const queryEmbedding = stubEmbed(body.query)
      const limit = body.limit || 10

      let rpcParams: Record<string, any> = {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: limit,
        p_account_id: ctx.accountId,
      }

      let query = db.rpc('match_embeddings', rpcParams)

      const { data, error: dbErr } = await query
      if (dbErr) {
        const filterQuery = db
          .from('embeddings')
          .select('id, entity_type, entity_id, vector_type, metadata, model, created_at')
          .eq('account_id', ctx.accountId)
          .limit(limit)

        if (body.entity_type) filterQuery.eq('entity_type', body.entity_type)
        if (body.vector_type) filterQuery.eq('vector_type', body.vector_type)

        const { data: fallback } = await filterQuery
        return json(fallback || [])
      }

      return json(data || [])
    }

    const body = await parseBody<{
      entity_type: string
      entity_id: string
      vector_type: string
      content?: string
      embedding?: number[]
      metadata?: Record<string, any>
      model?: string
    }>(req)

    if (!body.entity_type || !body.entity_id || !body.vector_type) {
      return error('entity_type, entity_id, and vector_type required')
    }

    const embedding = body.embedding || stubEmbed(body.content || '')

    const { data, error: dbErr } = await db
      .from('embeddings')
      .upsert({
        account_id: ctx.accountId,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        vector_type: body.vector_type,
        embedding: JSON.stringify(embedding),
        metadata: body.metadata || {},
        model: body.model || 'stub-embedder',
      }, {
        onConflict: 'account_id,entity_type,entity_id,vector_type',
      })
      .select('id, entity_type, entity_id, vector_type, metadata, model, created_at')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'upsert', 'embedding', data.id, null, data)
    await emitActivity(ctx, 'embedding.upserted', `Upserted embedding for ${body.entity_type}/${body.entity_id}`, 'embedding', data.id)

    return json(data, 201)
  },
})
