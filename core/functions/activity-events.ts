import { createHandler, requireAuth, requireTenant, json, error, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    let query = db
      .from('activity_events')
      .select('*, persons:person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    const eventType = params.get('event_type')
    const entityType = params.get('entity_type')
    const entityId = params.get('entity_id')
    const limit = clampLimit(params)

    if (eventType) query = query.eq('event_type', eventType)
    if (entityType) query = query.eq('entity_type', entityType)
    if (entityId) query = query.eq('entity_id', entityId)

    const { data } = await query.limit(limit)
    return json(data || [])
  },
})
