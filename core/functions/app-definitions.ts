import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity } from './_shared/audit'

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
        .from('app_definitions')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    if (slug) {
      const { data } = await db
        .from('app_definitions')
        .select('*')
        .eq('slug', slug)
        .eq('account_id', ctx.accountId)
        .eq('is_active', true)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const limit = clampLimit(params)
    const includeInactive = params.get('include_inactive') === 'true'

    let query = db
      .from('app_definitions')
      .select('*')
      .eq('account_id', ctx.accountId)

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data } = await query.order('name').limit(limit)

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

    // Clone action: duplicate a pack-owned app as a tenant draft
    if (body.action === 'clone' && body.source_id) {
      const { data: source } = await db
        .from('app_definitions')
        .select('*')
        .eq('id', body.source_id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!source) return error('Source app not found', 404)

      const clonedSlug = `${source.slug}-custom`
      const { data: cloned, error: cloneErr } = await db
        .from('app_definitions')
        .insert({
          account_id: ctx.accountId,
          slug: clonedSlug,
          name: `${source.name} (Custom)`,
          icon: source.icon,
          description: source.description,
          nav_items: source.nav_items || [],
          default_view: source.default_view,
          min_role: source.min_role || 'member',
          integration_deps: source.integration_deps || [],
          is_active: false,
          ownership: 'tenant',
        })
        .select()
        .single()

      if (cloneErr) return error(cloneErr.message, 500)
      await emitActivity(ctx, 'app_definition.cloned', `Cloned app "${source.name}" as "${cloned.name}"`, 'app', cloned.id)
      return json(cloned, 201)
    }

    if (!body.slug || !body.name) {
      return error('slug and name required')
    }

    const { data, error: dbErr } = await db
      .from('app_definitions')
      .insert({
        account_id: ctx.accountId,
        slug: body.slug,
        name: body.name,
        icon: body.icon || null,
        description: body.description || null,
        nav_items: body.nav_items || [],
        default_view: body.default_view || null,
        min_role: body.min_role || 'member',
        integration_deps: body.integration_deps || [],
        is_active: body.is_active ?? false,
        ownership: 'tenant',
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitActivity(ctx, 'app_definition.created', `Created app "${data.name}"`, 'app', data.id)
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

    const { data: existing } = await db.from('app_definitions').select('id').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!existing) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.slug !== undefined) updates.slug = body.slug
    if (body.icon !== undefined) updates.icon = body.icon
    if (body.description !== undefined) updates.description = body.description
    if (body.nav_items !== undefined) updates.nav_items = body.nav_items
    if (body.default_view !== undefined) updates.default_view = body.default_view
    if (body.min_role !== undefined) updates.min_role = body.min_role
    if (body.integration_deps !== undefined) updates.integration_deps = body.integration_deps
    if (body.is_active !== undefined) updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) return error('No fields to update')

    updates.ownership = 'tenant'

    const { data, error: dbErr } = await db
      .from('app_definitions')
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
      .from('app_definitions')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)
    return json({ success: true })
  },
})
