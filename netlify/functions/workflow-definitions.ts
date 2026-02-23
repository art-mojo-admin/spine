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
        .from('workflow_definitions')
        .select('*, stage_definitions(*)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const { data } = await db
      .from('workflow_definitions')
      .select('*, stage_definitions(count)')
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

    const body = await parseBody<{ name: string; description?: string; config?: any }>(req)
    if (!body.name) return error('name required')

    const { data, error: dbErr } = await db
      .from('workflow_definitions')
      .insert({ account_id: ctx.accountId, name: body.name, description: body.description || null, config: body.config || {} })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'workflow_definition', data.id, null, data)
    await emitActivity(ctx, 'workflow.created', `Created workflow "${data.name}"`, 'workflow_definition', data.id)

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

    const { data: before } = await db.from('workflow_definitions').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Not found', 404)

    const body = await parseBody(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.status !== undefined) updates.status = body.status
    if (body.config !== undefined) updates.config = body.config
    if (body.public_config !== undefined) updates.public_config = body.public_config

    const { data, error: dbErr } = await db.from('workflow_definitions').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'workflow_definition', id, before, data)
    await emitActivity(ctx, 'workflow.updated', `Updated workflow "${data.name}"`, 'workflow_definition', id)

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

    const { data: before } = await db.from('workflow_definitions').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Not found', 404)

    await db.from('workflow_definitions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'workflow_definition', id, before, null)
    await emitActivity(ctx, 'workflow.deleted', `Deleted workflow "${before.name}"`, 'workflow_definition', id)

    return json({ success: true })
  },
})
