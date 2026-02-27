import { createHandler, requireAuth, requireTenant, requireRole, json, error, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    let query = db
      .from('audit_log')
      .select('*, persons:person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    const entityType = params.get('entity_type')
    const entityId = params.get('entity_id')
    const action = params.get('action')
    const limit = clampLimit(params)

    if (entityType) query = query.eq('entity_type', entityType)
    if (entityId) query = query.eq('entity_id', entityId)
    if (action) query = query.eq('action', action)

    const { data } = await query.limit(limit)
    return json(data || [])
  },
})
