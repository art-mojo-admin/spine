import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import crypto from 'crypto'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db.from('webhook_subscriptions').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
      if (!data) return error('Not found', 404)
      return json(data)
    }

    const { data } = await db.from('webhook_subscriptions').select('*').eq('account_id', ctx.accountId).order('created_at', { ascending: false })
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.url) return error('url required')

    const signingSecret = crypto.randomBytes(32).toString('hex')

    const { data, error: dbErr } = await db
      .from('webhook_subscriptions')
      .insert({
        account_id: ctx.accountId,
        url: body.url,
        enabled: body.enabled !== false,
        event_types: body.event_types || [],
        signing_secret: signingSecret,
        description: body.description || null,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'webhook_subscription', data.id, null, data)
    await emitActivity(ctx, 'webhook.created', `Created webhook subscription`, 'webhook_subscription', data.id)
    await emitOutboxEvent(ctx.accountId!, 'webhook.created', 'webhook_subscription', data.id, data)

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db.from('webhook_subscriptions').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.url !== undefined) updates.url = body.url
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.event_types !== undefined) updates.event_types = body.event_types
    if (body.description !== undefined) updates.description = body.description

    const { data, error: dbErr } = await db.from('webhook_subscriptions').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'webhook_subscription', id, before, data)
    await emitActivity(ctx, 'webhook.updated', `Updated webhook subscription`, 'webhook_subscription', id)
    await emitOutboxEvent(ctx.accountId!, 'webhook.updated', 'webhook_subscription', id, { before, after: data })

    return json(data)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db.from('webhook_subscriptions').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Not found', 404)

    await db.from('webhook_subscriptions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'webhook_subscription', id, before, null)
    await emitActivity(ctx, 'webhook.deleted', `Deleted webhook subscription`, 'webhook_subscription', id)
    await emitOutboxEvent(ctx.accountId!, 'webhook.deleted', 'webhook_subscription', id, before)

    return json({ success: true })
  },
})
