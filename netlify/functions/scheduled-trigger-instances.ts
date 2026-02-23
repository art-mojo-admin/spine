import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const triggerId = params.get('trigger_id')
    const status = params.get('status')

    let query = db
      .from('scheduled_trigger_instances')
      .select('*, trigger:trigger_id(id, name, trigger_type)')
      .eq('account_id', ctx.accountId)
      .order('fire_at', { ascending: false })

    if (triggerId) query = query.eq('trigger_id', triggerId)
    if (status) query = query.eq('status', status)

    const { data } = await query.limit(200)
    return json(data || [])
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

    const { data: instance } = await db
      .from('scheduled_trigger_instances')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!instance) return error('Not found', 404)
    if (instance.status !== 'pending') return error('Only pending instances can be updated')

    const body = await parseBody<any>(req)

    if (body.status === 'cancelled') {
      const { data, error: dbErr } = await db
        .from('scheduled_trigger_instances')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)
      return json(data)
    }

    return error('Only cancellation is supported')
  },
})
