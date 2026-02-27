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
        .from('workflow_actions')
        .select('*, workflow_definitions!inner(account_id)')
        .eq('id', id)
        .eq('workflow_definitions.account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const workflowId = params.get('workflow_definition_id')
    if (!workflowId) return error('workflow_definition_id required')

    const { data: wf } = await db
      .from('workflow_definitions')
      .select('id')
      .eq('id', workflowId)
      .eq('account_id', ctx.accountId)
      .single()

    if (!wf) return error('Workflow not found', 404)

    let query = db
      .from('workflow_actions')
      .select('*')
      .eq('workflow_definition_id', workflowId)
      .eq('is_active', true)
      .order('position', { ascending: true })

    const triggerType = params.get('trigger_type')
    if (triggerType) query = query.eq('trigger_type', triggerType)

    const triggerRefId = params.get('trigger_ref_id')
    if (triggerRefId) query = query.eq('trigger_ref_id', triggerRefId)

    const { data } = await query
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
    if (!body.workflow_definition_id || !body.name || !body.trigger_type || !body.action_type) {
      return error('workflow_definition_id, name, trigger_type, and action_type required')
    }

    const { data: wf } = await db
      .from('workflow_definitions')
      .select('id')
      .eq('id', body.workflow_definition_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!wf) return error('Workflow not found', 404)

    const { data, error: dbErr } = await db
      .from('workflow_actions')
      .insert({
        workflow_definition_id: body.workflow_definition_id,
        name: body.name,
        trigger_type: body.trigger_type,
        trigger_ref_id: body.trigger_ref_id || null,
        action_type: body.action_type,
        action_config: body.action_config || {},
        conditions: body.conditions || [],
        position: body.position ?? 0,
        enabled: body.enabled !== false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'workflow_action', data.id, null, data)
    await emitActivity(ctx, 'workflow_action.created', `Created action "${data.name}"`, 'workflow_action', data.id)

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
      .from('workflow_actions')
      .select('*, workflow_definitions!inner(account_id)')
      .eq('id', id)
      .eq('workflow_definitions.account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.trigger_type !== undefined) updates.trigger_type = body.trigger_type
    if (body.trigger_ref_id !== undefined) updates.trigger_ref_id = body.trigger_ref_id
    if (body.action_type !== undefined) updates.action_type = body.action_type
    if (body.action_config !== undefined) updates.action_config = body.action_config
    if (body.conditions !== undefined) updates.conditions = body.conditions
    if (body.position !== undefined) updates.position = body.position
    if (body.enabled !== undefined) updates.enabled = body.enabled

    const { data, error: dbErr } = await db
      .from('workflow_actions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'workflow_action', id, before, data)
    await emitActivity(ctx, 'workflow_action.updated', `Updated action "${data.name}"`, 'workflow_action', id)

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
      .from('workflow_actions')
      .select('*, workflow_definitions!inner(account_id)')
      .eq('id', id)
      .eq('workflow_definitions.account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('workflow_actions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'workflow_action', id, before, null)
    await emitActivity(ctx, 'workflow_action.deleted', `Deleted action "${before.name}"`, 'workflow_action', id)

    return json({ success: true })
  },
})
