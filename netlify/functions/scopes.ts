import { createHandler, requireAuth, requireRole, json, error } from './_shared/middleware'
import { db } from './_shared/db'

function isSystem(ctxRole: string | null): boolean {
  return !!ctxRole && ['system_admin', 'system_operator'].includes(ctxRole)
}

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const includeInactive = params.get('include_inactive') === 'true'
    const includeCapabilities = params.get('include_capabilities') !== 'false'

    let targetAccountId = ctx.accountId
    const requestedAccountId = params.get('account_id')
    if (requestedAccountId && requestedAccountId !== ctx.accountId) {
      if (!isSystem(ctx.systemRole)) return error('Insufficient permissions', 403)
      targetAccountId = requestedAccountId
    }

    const baseSelect = [
      'id',
      'slug',
      'label',
      'description',
      'category',
      'default_role',
      'default_bundle',
      'enabled_levels',
      'metadata',
      'is_active',
      'created_at',
      'updated_at',
    ]

    const selectFragment = includeCapabilities
      ? `${baseSelect.join(', ')}, scope_capabilities ( id, capability, capability_type, record_type, field_path, description, default_policies, metadata )`
      : baseSelect.join(', ')

    let query = db
      .from('auth_scopes')
      .select(selectFragment)
      .order('category', { ascending: true })
      .order('label', { ascending: true })

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data: scopes, error: scopesErr } = await query
    if (scopesErr) return error(scopesErr.message, 500)

    if (!targetAccountId) {
      return json(scopes || [])
    }

    const { data: accountScopes, error: accountErr } = await db
      .from('account_scopes')
      .select('*')
      .eq('account_id', targetAccountId)

    if (accountErr) return error(accountErr.message, 500)

    const scopedMap = new Map((accountScopes || []).map((row) => [row.scope_id, row]))
    const enriched = (scopes || []).map((scope) => ({
      ...scope,
      account_scope: scopedMap.get(scope.id) || null,
    }))

    return json(enriched)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const systemCheck = isSystem(ctx.systemRole) ? null : error('System role required', 403)
    if (systemCheck) return systemCheck

    const body = await req.json()

    if (!body.slug || !body.label || !body.category) {
      return error('slug, label, and category are required')
    }

    const payload = {
      slug: body.slug,
      label: body.label,
      description: body.description || null,
      category: body.category,
      default_role: body.default_role || null,
      default_bundle: body.default_bundle || {},
      enabled_levels: body.enabled_levels || ['system', 'account', 'account_node', 'self'],
      metadata: body.metadata || {},
      is_active: body.is_active !== false,
    }

    const { data, error: dbErr } = await db.from('auth_scopes').insert(payload).select().single()
    if (dbErr) return error(dbErr.message, 500)

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    if (!isSystem(ctx.systemRole)) return error('System role required', 403)

    const slug = params.get('slug')
    const id = params.get('id')
    if (!slug && !id) return error('slug or id required')

    const body = await req.json()
    const updates: Record<string, any> = {}
    const allowedFields = [
      'label',
      'description',
      'category',
      'default_role',
      'default_bundle',
      'enabled_levels',
      'metadata',
      'is_active',
    ]
    for (const key of allowedFields) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return error('No valid fields provided')
    }

    let query = db.from('auth_scopes').update(updates)
    if (id) query = query.eq('id', id)
    if (slug) query = query.eq('slug', slug)

    const { data, error: dbErr } = await query.select().single()
    if (dbErr) return error(dbErr.message, 500)

    return json(data)
  },
})
