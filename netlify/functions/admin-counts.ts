import { createHandler, requireAuth, requireTenant, requireRole, json } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const { data } = await db
      .from('admin_counts')
      .select('counter_key, counter_value')
      .eq('account_id', ctx.accountId)

    const counts: Record<string, number> = {}
    for (const row of data || []) {
      counts[row.counter_key] = row.counter_value
    }

    return json(counts)
  },
})
