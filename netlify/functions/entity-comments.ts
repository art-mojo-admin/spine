import { createHandler, requireAuth, requireTenant, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const entityType = params.get('entity_type')
    const entityId = params.get('entity_id')

    if (!entityType || !entityId) {
      return error('entity_type and entity_id are required')
    }

    const limit = clampLimit(params)

    const { data } = await db
      .from('entity_comments')
      .select('*, person:person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
      .limit(limit)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      entity_type: string
      entity_id: string
      body: string
      role?: string
      is_internal?: boolean
      metadata?: Record<string, any>
    }>(req)

    if (!body.entity_type || !body.entity_id || !body.body?.trim()) {
      return error('entity_type, entity_id, and body are required')
    }

    const { data, error: dbErr } = await db
      .from('entity_comments')
      .insert({
        account_id: ctx.accountId,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        person_id: ctx.personId,
        role: body.role || 'user',
        body: body.body,
        is_internal: body.is_internal || false,
        metadata: body.metadata || {},
      })
      .select('*, person:person_id(id, full_name)')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'entity_comment', data.id, null, data)
    await emitActivity(
      ctx,
      'entity_comment.created',
      `Commented on ${body.entity_type}`,
      body.entity_type,
      body.entity_id,
      { comment_id: data.id },
    )
    await emitOutboxEvent(ctx.accountId!, 'entity_comment.created', 'entity_comment', data.id, data)

    return json(data, 201)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('entity_comments')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    // Only the author or admins can delete
    if (before.person_id !== ctx.personId && ctx.accountRole !== 'admin') {
      return error('Only the author or admins can delete comments', 403)
    }

    await db.from('entity_comments').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'entity_comment', id, before, null)
    await emitActivity(
      ctx,
      'entity_comment.deleted',
      `Deleted comment on ${before.entity_type}`,
      before.entity_type,
      before.entity_id,
    )

    return json({ success: true })
  },
})
