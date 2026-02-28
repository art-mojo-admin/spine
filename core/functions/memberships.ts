import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import { adjustCount } from './_shared/counts'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data: memberships } = await db
      .from('memberships')
      .select('*, persons(id, email, full_name, status)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    return json(memberships || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{ person_id: string; account_role?: string }>(req)
    if (!body.person_id) return error('person_id required')

    const { data: membership, error: dbErr } = await db
      .from('memberships')
      .insert({
        person_id: body.person_id,
        account_id: ctx.accountId,
        account_role: body.account_role || 'member',
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'membership', membership.id, null, membership)
    await emitActivity(ctx, 'membership.created', `Added member to account`, 'membership', membership.id)
    await emitOutboxEvent(ctx.accountId!, 'membership.created', 'membership', membership.id, membership)

    if (membership.status === 'active' && !membership.is_test_data) {
      await adjustCount(ctx.accountId!, 'members', 1)
    }
    return json(membership, 201)
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

    const { data: before } = await db.from('memberships').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Membership not found', 404)

    const body = await parseBody(req)
    const updates: Record<string, any> = {}
    if (body.account_role !== undefined) updates.account_role = body.account_role
    if (body.status !== undefined) updates.status = body.status

    const { data: membership, error: dbErr } = await db
      .from('memberships')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'membership', id, before, membership)
    await emitActivity(ctx, 'membership.updated', `Updated membership role`, 'membership', id)
    await emitOutboxEvent(ctx.accountId!, 'membership.updated', 'membership', id, { before, after: membership })

    if (body.status !== undefined && !before.is_test_data) {
      const wasActive = before.status === 'active'
      const nowActive = membership.status === 'active'
      if (wasActive !== nowActive) {
        await adjustCount(ctx.accountId!, 'members', nowActive ? 1 : -1)
      }
    }
    return json(membership)
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

    const { data: before } = await db.from('memberships').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Membership not found', 404)

    await db.from('memberships').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'membership', id, before, null)
    await emitActivity(ctx, 'membership.deleted', `Removed member from account`, 'membership', id)
    await emitOutboxEvent(ctx.accountId!, 'membership.deleted', 'membership', id, before)

    if (before.status === 'active' && !before.is_test_data) {
      await adjustCount(ctx.accountId!, 'members', -1)
    }
    return json({ success: true })
  },
})
