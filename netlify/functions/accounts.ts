import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const id = params.get('id')

    if (id) {
      const tenantCheck = requireTenant(ctx)
      if (tenantCheck) return tenantCheck

      if (id !== ctx.accountId && !ctx.systemRole) {
        return error('Access denied', 403)
      }

      const { data: account, error: dbErr } = await db
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single()

      if (dbErr || !account) return error('Account not found', 404)
      return json(account)
    }

    if (ctx.systemRole && ['system_admin', 'system_operator'].includes(ctx.systemRole)) {
      const includeInactive = params.get('include_inactive') === 'true'
      let sysQuery = db
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!includeInactive) sysQuery = sysQuery.eq('is_active', true)

      const { data: accounts } = await sysQuery
      return json(accounts || [])
    }

    const { data: memberships } = await db
      .from('memberships')
      .select('account_id')
      .eq('person_id', ctx.personId)
      .eq('status', 'active')

    const accountIds = (memberships || []).map((m: any) => m.account_id)
    if (accountIds.length === 0) return json([])

    let acctQuery = db
      .from('accounts')
      .select('*')
      .in('id', accountIds)
      .order('created_at', { ascending: false })

    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    if (!includeInactive) acctQuery = acctQuery.eq('is_active', true)

    const { data: accounts } = await acctQuery
    return json(accounts || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const body = await parseBody<{ display_name: string; account_type: string }>(req)
    if (!body.display_name) return error('display_name required')

    const { data: account, error: dbErr } = await db
      .from('accounts')
      .insert({
        display_name: body.display_name,
        account_type: body.account_type || 'organization',
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await db.from('memberships').insert({
      person_id: ctx.personId,
      account_id: account.id,
      account_role: 'admin',
      status: 'active',
    })

    await emitAudit(ctx, 'create', 'account', account.id, null, account)
    await emitActivity(ctx, 'account.created', `Created account "${account.display_name}"`, 'account', account.id)
    await emitOutboxEvent(account.id, 'account.created', 'account', account.id, account)

    return json(account, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id') || ctx.accountId
    if (!id) return error('id required')

    const { data: before } = await db.from('accounts').select('*').eq('id', id).single()
    if (!before) return error('Account not found', 404)

    const body = await parseBody(req)
    const updates: Record<string, any> = {}
    if (body.display_name !== undefined) updates.display_name = body.display_name
    if (body.status !== undefined) updates.status = body.status
    if (body.settings !== undefined) updates.settings = body.settings
    if (body.metadata !== undefined) updates.metadata = { ...(before.metadata || {}), ...body.metadata }
    if (body.slug !== undefined) updates.slug = body.slug

    const { data: account, error: dbErr } = await db
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'account', id, before, account)
    await emitActivity(ctx, 'account.updated', `Updated account "${account.display_name}"`, 'account', id)
    await emitOutboxEvent(ctx.accountId!, 'account.updated', 'account', id, { before, after: account })

    return json(account)
  },
})
