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
      .from('tenant_themes')
      .select('*')
      .eq('account_id', ctx.accountId)
      .single()

    return json(data || { preset: 'clean', tokens: {}, dark_tokens: {}, logo_url: null })
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)

    const { data: existing } = await db
      .from('tenant_themes')
      .select('id')
      .eq('account_id', ctx.accountId)
      .single()

    let result
    if (existing) {
      const { data, error: dbErr } = await db
        .from('tenant_themes')
        .update({
          preset: body.preset || 'custom',
          logo_url: body.logo_url,
          tokens: body.tokens || {},
          dark_tokens: body.dark_tokens || {},
        })
        .eq('account_id', ctx.accountId)
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)
      result = data
    } else {
      const { data, error: dbErr } = await db
        .from('tenant_themes')
        .insert({
          account_id: ctx.accountId,
          preset: body.preset || 'clean',
          logo_url: body.logo_url || null,
          tokens: body.tokens || {},
          dark_tokens: body.dark_tokens || {},
        })
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)
      result = data
    }

    await emitAudit(ctx, 'update', 'tenant_theme', result.id, null, result)
    await emitActivity(ctx, 'theme.updated', 'Updated tenant theme', 'tenant_theme', result.id)

    return json(result)
  },
})
