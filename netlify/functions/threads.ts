import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('threads')
        .select('*, messages(id, person_id, direction, body, sequence, visibility, metadata, created_at, persons:person_id(id, full_name))')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const targetType = params.get('target_type')
    const targetId = params.get('target_id')
    const threadType = params.get('thread_type')
    const status = params.get('status')
    const limit = clampLimit(params)

    let query = db
      .from('threads')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    if (targetType) query = query.eq('target_type', targetType)
    if (targetId) query = query.eq('target_id', targetId)
    if (threadType) query = query.eq('thread_type', threadType)
    if (status) query = query.eq('status', status)

    const { data } = await query.limit(limit)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<any>(req)
    if (!body.target_type || !body.target_id) {
      return error('target_type and target_id required')
    }

    const { data, error: dbErr } = await db
      .from('threads')
      .insert({
        account_id: ctx.accountId,
        target_type: body.target_type,
        target_id: body.target_id,
        thread_type: body.thread_type || 'discussion',
        visibility: body.visibility || 'internal',
        status: body.status || 'open',
        metadata: body.metadata || {},
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitActivity(ctx, 'thread.created', `Created ${body.thread_type || 'discussion'} thread`, 'thread', data.id)

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: existing } = await db.from('threads').select('id').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!existing) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.status !== undefined) updates.status = body.status
    if (body.visibility !== undefined) updates.visibility = body.visibility
    if (body.thread_type !== undefined) updates.thread_type = body.thread_type
    if (body.metadata !== undefined) updates.metadata = body.metadata

    if (Object.keys(updates).length === 0) return error('No fields to update')

    const { data, error: dbErr } = await db
      .from('threads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    return json(data)
  },
})
