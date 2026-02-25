import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

const ROLE_RANK: Record<string, number> = { portal: 0, member: 1, operator: 2, admin: 3 }

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data } = await db
      .from('nav_overrides')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .order('position', { ascending: true })

    // Filter by current user's role rank
    const userRank = ROLE_RANK[ctx.accountRole || ''] ?? -1
    const filtered = (data || []).filter((o: any) => {
      const required = ROLE_RANK[o.min_role] ?? 0
      return userRank >= required
    })

    return json(filtered)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      nav_key: string
      label?: string
      hidden?: boolean
      min_role?: string
      default_entity_id?: string
      position?: number
    }>(req)

    if (!body.nav_key) return error('nav_key is required')

    const { data, error: dbErr } = await db
      .from('nav_overrides')
      .upsert({
        account_id: ctx.accountId,
        nav_key: body.nav_key,
        label: body.label ?? null,
        hidden: body.hidden ?? false,
        min_role: body.min_role || 'member',
        default_entity_id: body.default_entity_id ?? null,
        position: body.position ?? 0,
      }, { onConflict: 'account_id,nav_key' })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'upsert', 'nav_override', data.id, null, data)
    await emitActivity(ctx, 'nav_override.updated', `Updated nav override for "${body.nav_key}"`, 'nav_override', data.id)

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

    const { data: before } = await db
      .from('nav_overrides')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('nav_overrides').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'nav_override', id, before, null)
    await emitActivity(ctx, 'nav_override.deleted', `Removed nav override for "${before.nav_key}"`, 'nav_override', id)

    return json({ success: true })
  },
})
