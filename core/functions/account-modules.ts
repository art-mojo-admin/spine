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
    const slug = url.searchParams.get('slug')

    let query = db
      .from('account_modules')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('installed_at', { ascending: true })

    if (slug) {
      query = query.eq('module_slug', slug)
    }

    const { data, error: dbErr } = await query
    if (dbErr) return error(dbErr.message, 500)

    return json(data)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      module_slug: string
      label: string
      description?: string
      enabled?: boolean
      config?: Record<string, any>
    }>(req)

    if (!body.module_slug || !body.label) {
      return error('module_slug and label are required')
    }

    const { data, error: dbErr } = await db
      .from('account_modules')
      .insert({
        account_id: ctx.accountId,
        module_slug: body.module_slug,
        label: body.label,
        description: body.description || null,
        enabled: body.enabled !== false,
        config: body.config || {},
      })
      .select()
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Module already installed', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'account_module', data.id, null, data)
    await emitActivity(ctx, 'module.installed', `Installed module "${body.label}"`, 'account_module', data.id)

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
      .from('account_modules')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Module not found', 404)

    const body = await parseBody<{
      enabled?: boolean
      config?: Record<string, any>
      label?: string
      description?: string
    }>(req)

    const updates: Record<string, any> = {}
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.config !== undefined) updates.config = body.config
    if (body.label !== undefined) updates.label = body.label
    if (body.description !== undefined) updates.description = body.description

    const { data, error: dbErr } = await db
      .from('account_modules')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'account_module', id, before, data)
    await emitActivity(ctx, 'module.updated', `Updated module "${data.label}"`, 'account_module', id)

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
      .from('account_modules')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Module not found', 404)

    const { error: dbErr } = await db
      .from('account_modules')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'delete', 'account_module', id, before, null)
    await emitActivity(ctx, 'module.removed', `Removed module "${before.label}"`, 'account_module', id)

    return json({ success: true })
  },
})
