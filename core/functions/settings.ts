import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data } = await db
      .from('accounts')
      .select('id, settings')
      .eq('id', ctx.accountId)
      .single()

    return json(data?.settings || {})
  },

  async PATCH(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const { data: before } = await db.from('accounts').select('settings').eq('id', ctx.accountId).single()
    const body = await parseBody<Record<string, any>>(req)

    const newSettings = { ...(before?.settings || {}), ...body }

    const { data, error: dbErr } = await db
      .from('accounts')
      .update({ settings: newSettings })
      .eq('id', ctx.accountId)
      .select('id, settings')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'account_settings', ctx.accountId!, before?.settings, data.settings)
    await emitActivity(ctx, 'settings.updated', 'Updated tenant settings', 'account', ctx.accountId!)

    return json(data.settings)
  },
})
