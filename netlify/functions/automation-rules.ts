import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('automation_rules')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const workflowId = params.get('workflow_definition_id')
    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let query = db
      .from('automation_rules')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (!includeInactive) query = query.eq('is_active', true)
    if (workflowId) query = query.eq('workflow_definition_id', workflowId)

    const { data } = await query.limit(200)
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
    if (!body.name || !body.trigger_event || !body.action_type) {
      return error('name, trigger_event, and action_type required')
    }

    const { data, error: dbErr } = await db
      .from('automation_rules')
      .insert({
        account_id: ctx.accountId,
        workflow_definition_id: body.workflow_definition_id || null,
        name: body.name,
        description: body.description || null,
        trigger_event: body.trigger_event,
        conditions: body.conditions || [],
        action_type: body.action_type,
        action_config: body.action_config || {},
        enabled: body.enabled !== false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'automation_rule', data.id, null, data)
    await emitActivity(ctx, 'automation.created', `Created automation "${data.name}"`, 'automation_rule', data.id)
    await emitOutboxEvent(ctx.accountId!, 'automation.created', 'automation_rule', data.id, data)

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
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.trigger_event !== undefined) updates.trigger_event = body.trigger_event
    if (body.conditions !== undefined) updates.conditions = body.conditions
    if (body.action_type !== undefined) updates.action_type = body.action_type
    if (body.action_config !== undefined) updates.action_config = body.action_config
    if (body.enabled !== undefined) updates.enabled = body.enabled

    const { data, error: dbErr } = await db
      .from('automation_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'automation_rule', id, before, data)
    await emitActivity(ctx, 'automation.updated', `Updated automation "${data.name}"`, 'automation_rule', id)
    await emitOutboxEvent(ctx.accountId!, 'automation.updated', 'automation_rule', id, { before, after: data })

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
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('automation_rules').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'automation_rule', id, before, null)
    await emitActivity(ctx, 'automation.deleted', `Deleted automation "${before.name}"`, 'automation_rule', id)
    await emitOutboxEvent(ctx.accountId!, 'automation.deleted', 'automation_rule', id, before)

    return json({ success: true })
  },
})
