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

    const { data } = await db
      .from('invites')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{ email: string; account_role?: string }>(req)
    if (!body.email) return error('email required')

    // Check for existing pending invite
    const { data: existing } = await db
      .from('invites')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('email', body.email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (existing) return error('Pending invite already exists for this email', 409)

    const { data, error: dbErr } = await db
      .from('invites')
      .insert({
        account_id: ctx.accountId,
        invited_by: ctx.personId,
        email: body.email.toLowerCase(),
        account_role: body.account_role || 'member',
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'invite', data.id, null, data)
    await emitActivity(ctx, 'invite.created', `Invited ${body.email} as ${data.account_role}`, 'invite', data.id)

    return json(data, 201)
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
      .from('invites')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('invites').update({ status: 'revoked' }).eq('id', id)
    await emitAudit(ctx, 'update', 'invite', id, before, { ...before, status: 'revoked' })
    await emitActivity(ctx, 'invite.revoked', `Revoked invite for ${before.email}`, 'invite', id)

    return json({ success: true })
  },
})
