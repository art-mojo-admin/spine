import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'
import { adjustCount } from './_shared/counts'

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data, error: dbErr } = await db
      .from('custom_action_types')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('name', { ascending: true })

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
      slug: string
      name: string
      description?: string
      handler_url: string
      config_schema?: Record<string, any>
    }>(req)

    if (!body.slug || !body.name || !body.handler_url) {
      return error('slug, name, and handler_url are required')
    }

    const { data, error: dbErr } = await db
      .from('custom_action_types')
      .insert({
        account_id: ctx.accountId,
        slug: body.slug,
        name: body.name,
        description: body.description || null,
        handler_url: body.handler_url,
        config_schema: body.config_schema || {},
      })
      .select()
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Action type slug already exists', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'custom_action_type', data.id, null, data)
    await emitActivity(ctx, 'custom_action_type.created', `Created custom action "${body.name}"`, 'custom_action_type', data.id)

    await adjustCount(ctx.accountId!, 'custom_actions', 1)
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
      .from('custom_action_types')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Custom action type not found', 404)

    const body = await parseBody<{
      name?: string
      description?: string
      handler_url?: string
      config_schema?: Record<string, any>
    }>(req)

    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.handler_url !== undefined) updates.handler_url = body.handler_url
    if (body.config_schema !== undefined) updates.config_schema = body.config_schema

    const { data, error: dbErr } = await db
      .from('custom_action_types')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'custom_action_type', id, before, data)
    await emitActivity(ctx, 'custom_action_type.updated', `Updated custom action "${data.name}"`, 'custom_action_type', id)

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
      .from('custom_action_types')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Custom action type not found', 404)

    const { error: dbErr } = await db
      .from('custom_action_types')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'delete', 'custom_action_type', id, before, null)
    await emitActivity(ctx, 'custom_action_type.deleted', `Deleted custom action "${before.name}"`, 'custom_action_type', id)

    await adjustCount(ctx.accountId!, 'custom_actions', -1)
    return json({ success: true })
  },
})
