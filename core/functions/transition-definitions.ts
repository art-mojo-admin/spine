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
        .from('transition_definitions')
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
      .from('transition_definitions')
      .select('*')
      .eq('workflow_definition_id', workflowId)
      .eq('is_active', true)
      .order('position', { ascending: true })

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
    if (!body.workflow_definition_id || !body.name || !body.from_stage_id || !body.to_stage_id) {
      return error('workflow_definition_id, name, from_stage_id, and to_stage_id required')
    }

    const { data: wf } = await db
      .from('workflow_definitions')
      .select('id')
      .eq('id', body.workflow_definition_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!wf) return error('Workflow not found', 404)

    const { data, error: dbErr } = await db
      .from('transition_definitions')
      .insert({
        workflow_definition_id: body.workflow_definition_id,
        name: body.name,
        from_stage_id: body.from_stage_id,
        to_stage_id: body.to_stage_id,
        conditions: body.conditions || [],
        require_comment: body.require_comment || false,
        require_fields: body.require_fields || [],
        position: body.position ?? 0,
        config: body.config || {},
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'transition_definition', data.id, null, data)
    await emitActivity(ctx, 'transition.created', `Created transition "${data.name}"`, 'transition_definition', data.id)

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
      .from('transition_definitions')
      .select('*, workflow_definitions!inner(account_id)')
      .eq('id', id)
      .eq('workflow_definitions.account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.from_stage_id !== undefined) updates.from_stage_id = body.from_stage_id
    if (body.to_stage_id !== undefined) updates.to_stage_id = body.to_stage_id
    if (body.conditions !== undefined) updates.conditions = body.conditions
    if (body.require_comment !== undefined) updates.require_comment = body.require_comment
    if (body.require_fields !== undefined) updates.require_fields = body.require_fields
    if (body.position !== undefined) updates.position = body.position
    if (body.config !== undefined) updates.config = body.config

    const { data, error: dbErr } = await db
      .from('transition_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'transition_definition', id, before, data)
    await emitActivity(ctx, 'transition.updated', `Updated transition "${data.name}"`, 'transition_definition', id)

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
      .from('transition_definitions')
      .select('*, workflow_definitions!inner(account_id)')
      .eq('id', id)
      .eq('workflow_definitions.account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('transition_definitions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'transition_definition', id, before, null)
    await emitActivity(ctx, 'transition.deleted', `Deleted transition "${before.name}"`, 'transition_definition', id)

    return json({ success: true })
  },
})
