import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const workflowId = params.get('workflow_definition_id')
    if (!workflowId) return error('workflow_definition_id required')

    const { data: wf } = await db.from('workflow_definitions').select('id').eq('id', workflowId).eq('account_id', ctx.accountId).single()
    if (!wf) return error('Workflow not found', 404)

    const { data } = await db
      .from('stage_definitions')
      .select('*')
      .eq('workflow_definition_id', workflowId)
      .order('position', { ascending: true })

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
    if (!body.workflow_definition_id || !body.name) return error('workflow_definition_id and name required')

    const { data: wf } = await db.from('workflow_definitions').select('id').eq('id', body.workflow_definition_id).eq('account_id', ctx.accountId).single()
    if (!wf) return error('Workflow not found', 404)

    const { data, error: dbErr } = await db
      .from('stage_definitions')
      .insert({
        workflow_definition_id: body.workflow_definition_id,
        name: body.name,
        description: body.description || null,
        position: body.position ?? 0,
        is_initial: body.is_initial || false,
        is_terminal: body.is_terminal || false,
        allowed_transitions: body.allowed_transitions || [],
        config: body.config || {},
        is_public: body.is_public || false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'stage_definition', data.id, null, data)
    await emitActivity(ctx, 'stage.created', `Created stage "${data.name}"`, 'stage_definition', data.id)

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
      .from('stage_definitions')
      .select('*, workflow_definitions!inner(account_id)')
      .eq('id', id)
      .eq('workflow_definitions.account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.position !== undefined) updates.position = body.position
    if (body.is_initial !== undefined) updates.is_initial = body.is_initial
    if (body.is_terminal !== undefined) updates.is_terminal = body.is_terminal
    if (body.allowed_transitions !== undefined) updates.allowed_transitions = body.allowed_transitions
    if (body.config !== undefined) updates.config = body.config
    if (body.is_public !== undefined) updates.is_public = body.is_public

    const { data, error: dbErr } = await db.from('stage_definitions').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'stage_definition', id, before, data)
    await emitActivity(ctx, 'stage.updated', `Updated stage "${data.name}"`, 'stage_definition', id)

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
      .from('stage_definitions')
      .select('*, workflow_definitions!inner(account_id)')
      .eq('id', id)
      .eq('workflow_definitions.account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('stage_definitions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'stage_definition', id, before, null)
    await emitActivity(ctx, 'stage.deleted', `Deleted stage "${before.name}"`, 'stage_definition', id)

    return json({ success: true })
  },
})
