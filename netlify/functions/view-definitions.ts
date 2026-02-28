import { createHandler, requireAuth, requireTenant, requireRole, requireMinRole, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity } from './_shared/audit'
import { adjustCount } from './_shared/counts'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    const slug = params.get('slug')

    if (id) {
      const { data } = await db
        .from('view_definitions')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    if (slug) {
      const { data } = await db
        .from('view_definitions')
        .select('*')
        .eq('slug', slug)
        .eq('account_id', ctx.accountId)
        .eq('is_active', true)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const viewType = params.get('view_type')
    const targetType = params.get('target_type')
    const limit = clampLimit(params)

    let query = db
      .from('view_definitions')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .order('name')

    if (viewType) query = query.eq('view_type', viewType)
    if (targetType) query = query.eq('target_type', targetType)

    const { data } = await query.limit(limit)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.slug || !body.name || !body.view_type) {
      return error('slug, name, and view_type required')
    }

    const { data, error: dbErr } = await db
      .from('view_definitions')
      .insert({
        account_id: ctx.accountId,
        slug: body.slug,
        name: body.name,
        view_type: body.view_type,
        target_type: body.target_type || null,
        target_filter: body.target_filter || {},
        config: body.config || {},
        min_role: body.min_role || 'member',
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitActivity(ctx, 'view_definition.created', `Created view "${data.name}"`, 'view', data.id)
    await adjustCount(ctx.accountId!, 'views', 1)
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

    const { data: existing } = await db.from('view_definitions').select('id').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!existing) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.slug !== undefined) updates.slug = body.slug
    if (body.view_type !== undefined) updates.view_type = body.view_type
    if (body.target_type !== undefined) updates.target_type = body.target_type
    if (body.target_filter !== undefined) updates.target_filter = body.target_filter
    if (body.config !== undefined) updates.config = body.config
    if (body.min_role !== undefined) updates.min_role = body.min_role

    if (Object.keys(updates).length === 0) return error('No fields to update')

    // Mark as tenant-owned if editing a pack-managed view
    updates.ownership = 'tenant'

    const { data, error: dbErr } = await db
      .from('view_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)
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

    const { error: dbErr } = await db
      .from('view_definitions')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)
    // View was active by default (is_active defaults true)
    await adjustCount(ctx.accountId!, 'views', -1)
    return json({ success: true })
  },
})
