import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    const principalType = params.get('principal_type')
    const includeInactive = params.get('include_inactive') === 'true'

    if (id) {
      let query = db
        .from('principals')
        .select(`
          *,
          persons:person_id (
            id,
            email,
            full_name,
            status
          ),
          machine_principals:machine_principal_id (
            id,
            name,
            kind,
            status,
            auth_mode
          )
        `)
        .eq('id', id)

      const { data } = await query
      if (!data) return error('Principal not found', 404)
      return json(data)
    }

    let query = db
      .from('principals')
      .select(`
        *,
        persons:person_id (
          id,
          email,
          full_name,
          status
        ),
        machine_principals:machine_principal_id (
          id,
          name,
          kind,
          status,
          auth_mode
        )
      `)
      .order('created_at', { ascending: false })

    if (principalType) query = query.eq('principal_type', principalType)
    if (!includeInactive) query = query.eq('status', 'active')

    const { data, error: dbErr } = await query.limit(200)
    if (dbErr) return error(dbErr.message, 500)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      principal_type: 'machine' | 'system' | 'service'
      person_id?: string
      machine_principal_id?: string
      display_name?: string
      metadata?: Record<string, unknown>
    }>(req)

    if (!body.principal_type) return error('principal_type required')
    if (body.principal_type === 'machine' && !body.machine_principal_id) {
      return error('machine_principal_id required for machine principals')
    }
    // Human principals are created automatically - no manual creation allowed

    const { data, error: dbErr } = await db
      .from('principals')
      .insert({
        principal_type: body.principal_type,
        person_id: body.person_id || null,
        machine_principal_id: body.machine_principal_id || null,
        display_name: body.display_name || null,
        metadata: body.metadata || {},
        status: 'active',
      })
      .select(`
        *,
        persons:person_id (
          id,
          email,
          full_name,
          status
        ),
        machine_principals:machine_principal_id (
          id,
          name,
          kind,
          status,
          auth_mode
        )
      `)
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') {
        return error('Principal already exists for this person/machine', 409)
      }
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'principal', data.id, null, data)
    await emitActivity(
      ctx,
      'principal.created',
      `Created ${body.principal_type} principal`,
      'principal',
      data.id,
      { principal_type: body.principal_type }
    )

    return json(data, 201)
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

    const { data: before } = await db
      .from('principals')
      .select('*')
      .eq('id', id)
      .single()

    if (!before) return error('Principal not found', 404)

    const body = await parseBody<{
      display_name?: string
      status?: 'active' | 'suspended' | 'revoked'
      metadata?: Record<string, unknown>
    }>(req)

    const updates: Record<string, unknown> = {}
    if (body.display_name !== undefined) updates.display_name = body.display_name
    if (body.status !== undefined) updates.status = body.status
    if (body.metadata !== undefined) updates.metadata = body.metadata

    if (Object.keys(updates).length === 0) return error('No valid fields provided')

    const { data, error: dbErr } = await db
      .from('principals')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        persons:person_id (
          id,
          email,
          full_name,
          status
        ),
        machine_principals:machine_principal_id (
          id,
          name,
          kind,
          status,
          auth_mode
        )
      `)
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'principal', id, before, data)
    await emitActivity(
      ctx,
      'principal.updated',
      `Updated principal`,
      'principal',
      id,
      { principal_type: data.principal_type }
    )

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
      .from('principals')
      .select('*')
      .eq('id', id)
      .single()

    if (!before) return error('Principal not found', 404)

    // Check for dependencies
    const { data: membershipDeps } = await db
      .from('memberships')
      .select('id')
      .eq('principal_id', id)
      .limit(1)

    if ((membershipDeps || []).length > 0) {
      return error('Cannot delete principal with active memberships', 409)
    }

    const { error: dbErr } = await db
      .from('principals')
      .delete()
      .eq('id', id)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'delete', 'principal', id, before, null)
    await emitActivity(
      ctx,
      'principal.deleted',
      `Deleted ${before.principal_type} principal`,
      'principal',
      id,
      { principal_type: before.principal_type }
    )

    return json({ success: true })
  },
})
