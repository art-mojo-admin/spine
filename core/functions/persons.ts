import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const id = params.get('id')

    if (id) {
      const tenantCheck = requireTenant(ctx)
      if (tenantCheck) return tenantCheck

      // Verify the person is a member of the current account
      const { data: membership } = await db
        .from('memberships')
        .select('person_id')
        .eq('person_id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!membership) return error('Person not found', 404)

      const { data: person } = await db
        .from('persons')
        .select('*')
        .eq('id', id)
        .single()

      if (!person) return error('Person not found', 404)

      const { data: profile } = await db
        .from('profiles')
        .select('*')
        .eq('person_id', id)
        .single()

      return json({ ...person, profile })
    }

    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data: memberships } = await db
      .from('memberships')
      .select('person_id, account_role, status')
      .eq('account_id', ctx.accountId)

    const personIds = (memberships || []).map((m: any) => m.person_id)
    if (personIds.length === 0) return json([])

    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let personsQuery = db
      .from('persons')
      .select('*, profiles(*)')
      .in('id', personIds)
      .order('full_name')

    if (!includeInactive) personsQuery = personsQuery.eq('is_active', true)

    const { data: persons } = await personsQuery

    const membershipMap = new Map((memberships || []).map((m: any) => [m.person_id, m]))

    const result = (persons || []).map((p: any) => ({
      ...p,
      profile: p.profiles?.[0] || null,
      membership: membershipMap.get(p.id) || null,
    }))

    return json(result)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{ email: string; full_name: string; display_name?: string }>(req)
    if (!body.email || !body.full_name) return error('email and full_name required')

    const { data: person, error: dbErr } = await db
      .from('persons')
      .insert({ email: body.email, full_name: body.full_name })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await db.from('profiles').insert({
      person_id: person.id,
      display_name: body.display_name || body.full_name,
    })

    await emitAudit(ctx, 'create', 'person', person.id, null, person)
    await emitActivity(ctx, 'person.created', `Created person "${person.full_name}"`, 'person', person.id)

    return json(person, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    // Verify the person is a member of the current account
    const { data: membership } = await db
      .from('memberships')
      .select('person_id')
      .eq('person_id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!membership) return error('Person not found', 404)

    const { data: before } = await db.from('persons').select('*').eq('id', id).single()
    if (!before) return error('Person not found', 404)

    const body = await parseBody(req)
    const updates: Record<string, any> = {}
    if (body.full_name !== undefined) updates.full_name = body.full_name
    if (body.email !== undefined) updates.email = body.email
    if (body.status !== undefined) updates.status = body.status
    if (body.metadata !== undefined) updates.metadata = { ...(before.metadata || {}), ...body.metadata }

    const { data: person, error: dbErr } = await db
      .from('persons')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'person', id, before, person)
    await emitActivity(ctx, 'person.updated', `Updated person "${person.full_name}"`, 'person', id)

    return json(person)
  },
})
