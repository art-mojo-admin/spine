import { createHandler, requireAuth, requireTenant, requireRole, requireMinRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const url = new URL(req.url)
    const location = url.searchParams.get('location')

    let query = db
      .from('nav_extensions')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (location) {
      query = query.eq('location', location)
    }

    const { data, error: dbErr } = await query
    if (dbErr) return error(dbErr.message, 500)

    // Filter by role rank — only return items the user can see
    const ROLE_RANK: Record<string, number> = { portal: 0, member: 1, operator: 2, admin: 3 }
    const userRank = ROLE_RANK[ctx.accountRole || ''] ?? -1
    const filtered = (data || []).filter((ext: any) => {
      const required = ROLE_RANK[ext.min_role] ?? 0
      return userRank >= required
    })

    // If modules are referenced, check they are enabled
    if (filtered.some((ext: any) => ext.module_slug)) {
      const { data: modules } = await db
        .from('account_modules')
        .select('module_slug')
        .eq('account_id', ctx.accountId)
        .eq('enabled', true)

      const enabledSlugs = new Set((modules || []).map((m: any) => m.module_slug))
      const result = filtered.filter((ext: any) => !ext.module_slug || enabledSlugs.has(ext.module_slug))
      return json(result)
    }

    return json(filtered)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      label: string
      icon?: string
      url: string
      location?: string
      position?: number
      min_role?: string
      module_slug?: string
    }>(req)

    if (!body.label || !body.url) {
      return error('label and url are required')
    }

    const { data, error: dbErr } = await db
      .from('nav_extensions')
      .insert({
        account_id: ctx.accountId,
        label: body.label,
        icon: body.icon || null,
        url: body.url,
        location: body.location || 'sidebar',
        position: body.position ?? 0,
        min_role: body.min_role || 'member',
        module_slug: body.module_slug || null,
      })
      .select()
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Nav extension with this label already exists', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'nav_extension', data.id, null, data)
    await emitActivity(ctx, 'nav_extension.created', `Created nav extension "${body.label}"`, 'nav_extension', data.id)

    return json(data, 201)
  },

  async PATCH(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return error('id is required')

    const { data: before } = await db
      .from('nav_extensions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Nav extension not found', 404)

    const body = await parseBody<{
      label?: string
      icon?: string
      url?: string
      location?: string
      position?: number
      min_role?: string
      module_slug?: string
    }>(req)

    const updates: Record<string, any> = {}
    if (body.label !== undefined) updates.label = body.label
    if (body.icon !== undefined) updates.icon = body.icon
    if (body.url !== undefined) updates.url = body.url
    if (body.location !== undefined) updates.location = body.location
    if (body.position !== undefined) updates.position = body.position
    if (body.min_role !== undefined) updates.min_role = body.min_role
    if (body.module_slug !== undefined) updates.module_slug = body.module_slug

    const { data, error: dbErr } = await db
      .from('nav_extensions')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'nav_extension', id, before, data)
    await emitActivity(ctx, 'nav_extension.updated', `Updated nav extension "${data.label}"`, 'nav_extension', id)

    return json(data)
  },

  async DELETE(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return error('id is required')

    const { data: before } = await db
      .from('nav_extensions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Nav extension not found', 404)

    const { error: dbErr } = await db
      .from('nav_extensions')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'delete', 'nav_extension', id, before, null)
    await emitActivity(ctx, 'nav_extension.deleted', `Deleted nav extension "${before.label}"`, 'nav_extension', id)

    return json({ success: true })
  },
})
