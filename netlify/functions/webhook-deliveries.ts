import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const subscriptionId = params.get('webhook_subscription_id')
    const status = params.get('status')

    let query = db
      .from('webhook_deliveries')
      .select('*, webhook_subscriptions!inner(account_id, url), outbox_events(event_type, payload)')
      .eq('webhook_subscriptions.account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (subscriptionId) query = query.eq('webhook_subscription_id', subscriptionId)
    if (status) query = query.eq('status', status)

    const { data } = await query.limit(200)
    return json(data || [])
  },

  async POST(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required for replay')

    const { data: delivery } = await db
      .from('webhook_deliveries')
      .select('*, webhook_subscriptions!inner(account_id)')
      .eq('id', id)
      .eq('webhook_subscriptions.account_id', ctx.accountId)
      .single()

    if (!delivery) return error('Not found', 404)

    const { error: dbErr } = await db
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
        completed_at: null,
      })
      .eq('id', id)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'replay', 'webhook_delivery', id, delivery, null)
    await emitActivity(ctx, 'webhook.replayed', `Replayed webhook delivery`, 'webhook_delivery', id)

    return json({ success: true, message: 'Delivery queued for retry' })
  },
})
