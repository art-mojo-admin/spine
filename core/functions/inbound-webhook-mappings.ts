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
    if (id) {
      const { data } = await db
        .from('inbound_webhook_mappings')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const { data } = await db
      .from('inbound_webhook_mappings')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.name || !body.event_name || !body.action) {
      return error('name, event_name, and action required')
    }

    const { data, error: dbErr } = await db
      .from('inbound_webhook_mappings')
      .insert({
        account_id: ctx.accountId,
        name: body.name,
        event_name: body.event_name,
        action: body.action,
        action_config: body.action_config || {},
        conditions: body.conditions || [],
        enabled: body.enabled !== false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'inbound_webhook_mapping', data.id, null, data)
    await emitActivity(ctx, 'inbound_webhook_mapping.created', `Created mapping "${data.name}"`, 'inbound_webhook_mapping', data.id)

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('inbound_webhook_mappings')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.event_name !== undefined) updates.event_name = body.event_name
    if (body.action !== undefined) updates.action = body.action
    if (body.action_config !== undefined) updates.action_config = body.action_config
    if (body.conditions !== undefined) updates.conditions = body.conditions
    if (body.enabled !== undefined) updates.enabled = body.enabled

    const { data, error: dbErr } = await db
      .from('inbound_webhook_mappings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'inbound_webhook_mapping', id, before, data)
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

    const { data: before } = await db
      .from('inbound_webhook_mappings')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('inbound_webhook_mappings').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'inbound_webhook_mapping', id, before, null)
    await emitActivity(ctx, 'inbound_webhook_mapping.deleted', `Deleted mapping "${before.name}"`, 'inbound_webhook_mapping', id)

    return json({ success: true })
  },
})
