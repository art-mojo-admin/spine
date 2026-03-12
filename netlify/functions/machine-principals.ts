import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

const ADMIN_ONLY = ['admin'] as const
const ADMIN_OR_OPERATOR = ['admin', 'operator'] as const

type MachineKind = 'automation' | 'api_key' | 'ai_agent' | 'integration'
type AuthMode = 'api_key' | 'signed_jwt' | 'oauth_client'
type Visibility = 'private' | 'shared'
type Status = 'active' | 'suspended' | 'revoked'

export default createHandler({
  async GET(_req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_OR_OPERATOR as unknown as string[])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    const statusFilter = params.get('status') as Status | null

    if (id) {
      const { data, error: dbErr } = await db
        .from('machine_principals')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()
      if (dbErr) return error(dbErr.message, dbErr.code === 'PGRST116' ? 404 : 500)
      if (!data) return error('Machine principal not found', 404)
      return json(data)
    }

    let query = db
      .from('machine_principals')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error: dbErr } = await query
    if (dbErr) return error(dbErr.message, 500)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY as unknown as string[])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      name: string
      description?: string
      kind?: MachineKind
      auth_mode?: AuthMode
      visibility?: Visibility
      audit_channel?: string
      metadata?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
    }>(req)

    if (!body.name) return error('name required')

    const payload = {
      account_id: ctx.accountId,
      name: body.name,
      description: body.description || null,
      kind: body.kind || 'automation',
      auth_mode: body.auth_mode || 'api_key',
      status: 'active' as Status,
      visibility: body.visibility || 'private',
      audit_channel: body.audit_channel || null,
      metadata: body.metadata || {},
      ownership: body.ownership || 'tenant',
      created_by: ctx.personId,
    }

    const { data, error: dbErr } = await db
      .from('machine_principals')
      .insert(payload)
      .select('*')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'machine_principal.create', 'machine_principal', data.id, null, data)
    await emitActivity(
      ctx,
      'machine_principal.created',
      `Created machine principal "${data.name}"`,
      'machine_principal',
      data.id,
    )

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY as unknown as string[])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('machine_principals')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Machine principal not found', 404)

    const body = await parseBody<{
      name?: string
      description?: string | null
      status?: Status
      kind?: MachineKind
      auth_mode?: AuthMode
      visibility?: Visibility
      audit_channel?: string | null
      metadata?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
    }>(req)

    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.status !== undefined) updates.status = body.status
    if (body.kind !== undefined) updates.kind = body.kind
    if (body.auth_mode !== undefined) updates.auth_mode = body.auth_mode
    if (body.visibility !== undefined) updates.visibility = body.visibility
    if (body.audit_channel !== undefined) updates.audit_channel = body.audit_channel
    if (body.metadata !== undefined) updates.metadata = body.metadata
    if (body.ownership !== undefined) updates.ownership = body.ownership

    if (Object.keys(updates).length === 0) {
      return error('No valid fields provided')
    }

    const { data, error: dbErr } = await db
      .from('machine_principals')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'machine_principal.update', 'machine_principal', id, before, data)
    await emitActivity(
      ctx,
      'machine_principal.updated',
      `Updated machine principal "${data.name}"`,
      'machine_principal',
      id,
    )

    return json(data)
  },

  async DELETE(_req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY as unknown as string[])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('machine_principals')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Machine principal not found', 404)

    const { data: assigned } = await db
      .from('principal_scopes')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('machine_principal_id', id)
      .limit(1)

    if ((assigned || []).length > 0) {
      return error('Remove scope assignments for this machine principal before deleting', 409)
    }

    const { error: dbErr } = await db
      .from('machine_principals')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'machine_principal.delete', 'machine_principal', id, before, null)
    await emitActivity(
      ctx,
      'machine_principal.deleted',
      `Deleted machine principal "${before.name}"`,
      'machine_principal',
      id,
    )

    return json({ success: true })
  },
})
