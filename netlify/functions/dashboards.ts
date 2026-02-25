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
    const getDefault = params.get('default')

    if (id) {
      const { data } = await db
        .from('dashboard_definitions')
        .select('*, widgets:dashboard_widgets(*)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    // Get default dashboard for current user
    if (getDefault === 'true') {
      const { data } = await db
        .from('dashboard_definitions')
        .select('*, widgets:dashboard_widgets(*)')
        .eq('account_id', ctx.accountId)
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle()

      return json(data || null)
    }

    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let listQuery = db
      .from('dashboard_definitions')
      .select('id, slug, title, description, is_default, min_role, created_at, updated_at')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (!includeInactive) listQuery = listQuery.eq('is_active', true)

    const { data } = await listQuery

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
      title: string
      slug?: string
      description?: string
      is_default?: boolean
      min_role?: string
      widgets?: Array<{
        widget_type: string
        title: string
        config?: Record<string, any>
        position?: Record<string, any>
        min_role?: string
      }>
    }>(req)

    if (!body.title) return error('title is required')

    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // If setting as default, unset other defaults
    if (body.is_default) {
      await db
        .from('dashboard_definitions')
        .update({ is_default: false })
        .eq('account_id', ctx.accountId)
        .eq('is_default', true)
    }

    const { data, error: dbErr } = await db
      .from('dashboard_definitions')
      .insert({
        account_id: ctx.accountId,
        slug,
        title: body.title,
        description: body.description || null,
        is_default: body.is_default || false,
        min_role: body.min_role || 'member',
        created_by: ctx.personId,
      })
      .select()
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Dashboard with this slug already exists', 409)
      return error(dbErr.message, 500)
    }

    // Create widgets if provided
    if (body.widgets?.length) {
      const widgetInserts = body.widgets.map((w) => ({
        dashboard_id: data.id,
        widget_type: w.widget_type,
        title: w.title,
        config: w.config || {},
        position: w.position || {},
        min_role: w.min_role || 'member',
      }))
      await db.from('dashboard_widgets').insert(widgetInserts)
    }

    // Re-fetch with widgets
    const { data: full } = await db
      .from('dashboard_definitions')
      .select('*, widgets:dashboard_widgets(*)')
      .eq('id', data.id)
      .single()

    await emitAudit(ctx, 'create', 'dashboard', data.id, null, full)
    await emitActivity(ctx, 'dashboard.created', `Created dashboard "${data.title}"`, 'dashboard', data.id)

    return json(full, 201)
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
      .from('dashboard_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.slug !== undefined) updates.slug = body.slug
    if (body.description !== undefined) updates.description = body.description
    if (body.min_role !== undefined) updates.min_role = body.min_role
    if (body.layout !== undefined) updates.layout = body.layout
    if (body.is_default !== undefined) {
      if (body.is_default) {
        await db
          .from('dashboard_definitions')
          .update({ is_default: false })
          .eq('account_id', ctx.accountId)
          .eq('is_default', true)
      }
      updates.is_default = body.is_default
    }

    const { data, error: dbErr } = await db
      .from('dashboard_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    // Replace widgets if provided
    if (body.widgets !== undefined) {
      await db.from('dashboard_widgets').delete().eq('dashboard_id', id)
      if (body.widgets?.length) {
        const widgetInserts = body.widgets.map((w: any) => ({
          dashboard_id: id,
          widget_type: w.widget_type,
          title: w.title,
          config: w.config || {},
          position: w.position || {},
          min_role: w.min_role || 'member',
        }))
        await db.from('dashboard_widgets').insert(widgetInserts)
      }
    }

    const { data: full } = await db
      .from('dashboard_definitions')
      .select('*, widgets:dashboard_widgets(*)')
      .eq('id', id)
      .single()

    await emitAudit(ctx, 'update', 'dashboard', id, before, full)
    await emitActivity(ctx, 'dashboard.updated', `Updated dashboard "${data.title}"`, 'dashboard', id)

    return json(full)
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
      .from('dashboard_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('dashboard_definitions').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'dashboard', id, before, null)
    await emitActivity(ctx, 'dashboard.deleted', `Deleted dashboard "${before.title}"`, 'dashboard', id)

    return json({ success: true })
  },
})
