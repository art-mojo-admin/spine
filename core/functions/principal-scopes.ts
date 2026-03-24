import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'
import { fetchScopeSummary } from './_shared/scopes'

const ADMIN_ONLY = ['admin']
const ADMIN_OR_OPERATOR = ['admin', 'operator']

type PrincipalType = 'human' | 'machine' | 'system'
type AssignmentType = 'direct' | 'role_bundle' | 'justification' | 'system_default'

async function ensurePersonInAccount(accountId: string, personId: string) {
  const { data, error: dbErr } = await db
    .from('memberships')
    .select('id')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .eq('status', 'active')
    .single()

  if (dbErr || !data) {
    throw new Error('Person is not an active member of this account')
  }
}

async function ensureMachinePrincipal(accountId: string, machinePrincipalId: string) {
  const { data, error: dbErr } = await db
    .from('machine_principals')
    .select('id')
    .eq('account_id', accountId)
    .eq('id', machinePrincipalId)
    .single()

  if (dbErr || !data) {
    throw new Error('Machine principal not found in this account')
  }
}

function validatePrincipalInput(body: {
  principal_type?: PrincipalType
  person_id?: string | null
  machine_principal_id?: string | null
}) {
  const principalType = body.principal_type || 'human'
  if (principalType === 'human') {
    if (!body.person_id) throw new Error('person_id required for human principal')
  } else if (principalType === 'machine') {
    if (!body.machine_principal_id) throw new Error('machine_principal_id required for machine principal')
  } else if (principalType === 'system') {
    if (body.person_id || body.machine_principal_id) {
      throw new Error('System principals cannot reference person or machine ids')
    }
  } else {
    throw new Error('Invalid principal_type')
  }

  return principalType
}

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_OR_OPERATOR)
    if (roleCheck) return roleCheck

    const principalType = params.get('principal_type') as PrincipalType | null
    const personId = params.get('person_id')
    const machinePrincipalId = params.get('machine_principal_id')
    const scopeIdParam = params.get('scope_id')
    const scopeSlugParam = params.get('scope_slug')

    let resolvedScopeId: string | null = scopeIdParam
    if (!resolvedScopeId && scopeSlugParam) {
      const scope = await fetchScopeSummary({ slug: scopeSlugParam })
      if (!scope) return error('Scope not found', 404)
      resolvedScopeId = scope.id
    }

    let query = db
      .from('principal_scopes')
      .select('*, auth_scopes ( slug, label, category ), persons:person_id ( id, full_name, email ), machine_principals:machine_principal_id ( id, name, kind, status )')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (principalType) query = query.eq('principal_type', principalType)
    if (personId) query = query.eq('person_id', personId)
    if (machinePrincipalId) query = query.eq('machine_principal_id', machinePrincipalId)
    if (resolvedScopeId) query = query.eq('scope_id', resolvedScopeId)

    const { data, error: dbErr } = await query
    if (dbErr) return error(dbErr.message, 500)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY)
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      principal_type?: PrincipalType
      person_id?: string
      machine_principal_id?: string
      scope_id?: string
      scope_slug?: string
      assignment_type?: AssignmentType
      granted_reason?: string
      notes?: string
      expires_at?: string | null
      metadata?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
    }>(req)

    const principalType = validatePrincipalInput(body)

    if (principalType === 'human' && body.person_id) {
      try {
        await ensurePersonInAccount(ctx.accountId!, body.person_id)
      } catch (err: any) {
        return error(err.message, 400)
      }
    }

    if (principalType === 'machine' && body.machine_principal_id) {
      try {
        await ensureMachinePrincipal(ctx.accountId!, body.machine_principal_id)
      } catch (err: any) {
        return error(err.message, 400)
      }
    }

    const scope = await fetchScopeSummary({ id: body.scope_id ?? null, slug: body.scope_slug ?? null })
    if (!scope) return error('Scope not found', 404)

    const payload = {
      account_id: ctx.accountId,
      scope_id: scope.id,
      principal_type: principalType,
      person_id: principalType === 'human' ? body.person_id : null,
      machine_principal_id: principalType === 'machine' ? body.machine_principal_id : null,
      assignment_type: body.assignment_type || 'direct',
      granted_by: ctx.personId,
      granted_reason: body.granted_reason || null,
      notes: body.notes || null,
      expires_at: body.expires_at || null,
      metadata: body.metadata || {},
      ownership: body.ownership || 'tenant',
    }

    const { data, error: dbErr } = await db
      .from('principal_scopes')
      .insert(payload)
      .select('*, auth_scopes ( slug, label, category ), persons:person_id ( id, full_name, email ), machine_principals:machine_principal_id ( id, name, kind, status )')
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') {
        return error('Scope already assigned to this principal', 409)
      }
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'principal_scope.create', 'principal_scope', data.id, null, data)
    await emitActivity(
      ctx,
      'principal_scope.created',
      `Granted ${scope.slug} to ${principalType}`,
      'principal_scope',
      data.id,
      { scope_slug: scope.slug, principal_type: principalType },
    )

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY)
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('principal_scopes')
      .select('*, auth_scopes ( slug, label, category ), persons:person_id ( id, full_name ), machine_principals:machine_principal_id ( id, name )')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Principal scope not found', 404)

    const body = await parseBody<{
      assignment_type?: AssignmentType
      notes?: string | null
      granted_reason?: string | null
      expires_at?: string | null
      metadata?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
    }>(req)

    const updates: Record<string, unknown> = {}

    if (body.assignment_type !== undefined) updates.assignment_type = body.assignment_type
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.granted_reason !== undefined) updates.granted_reason = body.granted_reason
    if (body.expires_at !== undefined) updates.expires_at = body.expires_at
    if (body.metadata !== undefined) updates.metadata = body.metadata
    if (body.ownership !== undefined) updates.ownership = body.ownership

    if (Object.keys(updates).length === 0) return error('No valid fields provided')

    const { data, error: dbErr } = await db
      .from('principal_scopes')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, auth_scopes ( slug, label, category ), persons:person_id ( id, full_name ), machine_principals:machine_principal_id ( id, name )')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'principal_scope.update', 'principal_scope', id, before, data)
    await emitActivity(
      ctx,
      'principal_scope.updated',
      `Updated principal scope ${before.auth_scopes?.slug || before.scope_id}`,
      'principal_scope',
      id,
    )

    return json(data)
  },

  async DELETE(_req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY)
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('principal_scopes')
      .select('*, auth_scopes ( slug, label, category )')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Principal scope not found', 404)

    const { error: dbErr } = await db
      .from('principal_scopes')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'principal_scope.delete', 'principal_scope', id, before, null)
    await emitActivity(
      ctx,
      'principal_scope.deleted',
      `Revoked scope ${before.auth_scopes?.slug || before.scope_id}`,
      'principal_scope',
      id,
    )

    return json({ success: true })
  },
})
