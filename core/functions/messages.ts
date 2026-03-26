import { createHandler, requireAuth, requireTenant, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const threadId = params.get('thread_id')
    if (!threadId) return error('thread_id required')

    const { data: thread } = await db
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .eq('account_id', ctx.accountId)
      .single()

    if (!thread) return error('Thread not found', 404)

    const limit = clampLimit(params, 100)
    const { data } = await db
      .from('messages')
      .select('*, persons:actor_principal_id(id, full_name)')
      .eq('thread_id', threadId)
      .eq('is_active', true)
      .order('sequence', { ascending: true })
      .limit(limit)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<any>(req)
    if (!body.thread_id || !body.body) {
      return error('thread_id and body required')
    }

    const { data: thread } = await db
      .from('threads')
      .select('id, account_id, target_type, target_id')
      .eq('id', body.thread_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!thread) return error('Thread not found', 404)

    const { data, error: dbErr } = await db
      .from('messages')
      .insert({
        thread_id: body.thread_id,
        actor_principal_id: body.actor_principal_id || ctx.personId,
        direction: body.direction || 'internal',
        body: body.body,
        visibility: body.visibility || 'inherit',
        metadata: body.metadata || {},
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    // Touch the thread's updated_at
    await db.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', body.thread_id)

    await emitActivity(
      ctx,
      'message.created',
      `New message in thread`,
      'message',
      data.id,
      { thread_id: body.thread_id, target_type: thread.target_type, target_id: thread.target_id },
    )

    return json(data, 201)
  },
})
