import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'
import { fetchScopeSummary } from './_shared/scopes'

function computeStatusTimestamps(
  status?: 'enabled' | 'disabled' | 'preview' | null,
): { enabled_at?: string | null; disabled_at?: string | null } {
  const now = new Date().toISOString()
  if (status === 'disabled') {
    return { enabled_at: null, disabled_at: now }
  }
  if (status === 'enabled' || status === 'preview' || !status) {
    return { enabled_at: now, disabled_at: null }
  }
  return {}
}

export default createHandler({
  async GET(_req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const { data, error: dbErr } = await db
      .from('account_scopes')
      .select('*, auth_scopes ( slug, label, category, description, default_role, default_bundle )')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: true })

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
      scope_id?: string
      scope_slug?: string
      status?: 'enabled' | 'disabled' | 'preview'
      source?: 'pack' | 'manual'
      ownership?: 'pack' | 'tenant'
      notes?: string
      config?: Record<string, unknown>
    }>(req)

    const scope = await fetchScopeSummary({ id: body.scope_id ?? null, slug: body.scope_slug ?? null })
    if (!scope) return error('Scope not found', 404)

    const { data: existing } = await db
      .from('account_scopes')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('scope_id', scope.id)
      .maybeSingle()

    if (existing) {
      return error('Scope already configured for this account', 409)
    }

    const status = body.status || 'enabled'
    const timestamps = computeStatusTimestamps(status)

    const payload = {
      account_id: ctx.accountId,
      scope_id: scope.id,
      status,
      source: body.source || 'manual',
      ownership: body.ownership || (body.source === 'pack' ? 'pack' : 'tenant'),
      notes: body.notes || null,
      config: body.config || {},
      updated_by: ctx.personId,
      ...timestamps,
    }

    const { data, error: insertErr } = await db
      .from('account_scopes')
      .insert(payload)
      .select('*, auth_scopes ( slug, label, category, description, default_role, default_bundle )')
      .single()

    if (insertErr) return error(insertErr.message, 500)

    await emitAudit(ctx, 'scope.enable', 'account_scope', data.id, null, data)
    await emitActivity(
      ctx,
      'scope.enabled',
      `Enabled scope ${scope.label}`,
      'account_scope',
      data.id,
      { scope_slug: scope.slug, status },
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
      .from('account_scopes')
      .select('*, auth_scopes ( slug, label, category, description, default_role, default_bundle )')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Scope assignment not found', 404)

    const body = await parseBody<{
      status?: 'enabled' | 'disabled' | 'preview'
      notes?: string | null
      config?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
    }>(req)

    const updates: Record<string, unknown> = { updated_by: ctx.personId }

    if (body.status) {
      updates.status = body.status
      Object.assign(updates, computeStatusTimestamps(body.status))
    }
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.config !== undefined) updates.config = body.config
    if (body.ownership !== undefined) updates.ownership = body.ownership

    if (Object.keys(updates).length === 1) {
      return error('No valid fields provided')
    }

    const { data, error: updateErr } = await db
      .from('account_scopes')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*, auth_scopes ( slug, label, category, description, default_role, default_bundle )')
      .single()

    if (updateErr) return error(updateErr.message, 500)

    await emitAudit(ctx, 'scope.update', 'account_scope', id, before, data)
    if (body.status && body.status !== before.status) {
      await emitActivity(
        ctx,
        'scope.status_changed',
        `Scope ${before.auth_scopes?.label || before.scope_id} set to ${body.status}`,
        'account_scope',
        id,
        { scope_slug: before.auth_scopes?.slug, status: body.status },
      )
    } else if (body.config !== undefined || body.notes !== undefined) {
      await emitActivity(
        ctx,
        'scope.updated',
        `Updated scope ${before.auth_scopes?.label || before.scope_id}`,
        'account_scope',
        id,
      )
    }

    return json(data)
  },
})
