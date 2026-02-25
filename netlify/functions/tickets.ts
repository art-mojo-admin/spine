import { createHandler, requireAuth, requireTenant, requireRole, requireMinRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import { evaluateAutomations } from './_shared/automation'
import { autoEmbed } from './_shared/embed'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('tickets')
        .select('*, opened_by:opened_by_person_id(id, full_name), assigned_to:assigned_to_person_id(id, full_name)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const status = params.get('status')
    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let query = db
      .from('tickets')
      .select('*, opened_by:opened_by_person_id(id, full_name), assigned_to:assigned_to_person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (!includeInactive) query = query.eq('is_active', true)
    if (status) query = query.eq('status', status)

    const { data } = await query.limit(200)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<any>(req)
    if (!body.subject) return error('subject required')

    const { data, error: dbErr } = await db
      .from('tickets')
      .insert({
        account_id: ctx.accountId,
        subject: body.subject,
        priority: body.priority || 'medium',
        category: body.category || null,
        opened_by_person_id: ctx.personId,
        assigned_to_person_id: body.assigned_to_person_id || null,
        entity_type: body.entity_type || null,
        entity_id: body.entity_id || null,
        metadata: body.metadata || {},
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'ticket', data.id, null, data)
    await emitActivity(ctx, 'ticket.created', `Created ticket "${data.subject}"`, 'ticket', data.id)
    await emitOutboxEvent(ctx.accountId!, 'ticket.created', 'ticket', data.id, data)
    await evaluateAutomations(ctx.accountId!, 'ticket.created', ctx, data)
    await autoEmbed(ctx.accountId!, 'ticket', data.id, `${data.subject} ${data.category || ''}`, { subject: data.subject })

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireMinRole(ctx, 'operator')
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db.from('tickets').select('*').eq('id', id).eq('account_id', ctx.accountId).single()
    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.subject !== undefined) updates.subject = body.subject
    if (body.status !== undefined) updates.status = body.status
    if (body.priority !== undefined) updates.priority = body.priority
    if (body.category !== undefined) updates.category = body.category
    if (body.assigned_to_person_id !== undefined) updates.assigned_to_person_id = body.assigned_to_person_id
    if (body.metadata !== undefined) {
      // Merge metadata so we don't clobber existing keys
      updates.metadata = { ...(before.metadata || {}), ...body.metadata }
    }

    const { data, error: dbErr } = await db.from('tickets').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'ticket', id, before, data)
    await emitActivity(ctx, 'ticket.updated', `Updated ticket "${data.subject}"`, 'ticket', id)
    await emitOutboxEvent(ctx.accountId!, 'ticket.updated', 'ticket', id, { before, after: data })
    await evaluateAutomations(ctx.accountId!, 'ticket.updated', ctx, { before, after: data, entity_id: id })
    await autoEmbed(ctx.accountId!, 'ticket', id, `${data.subject} ${data.category || ''}`, { subject: data.subject })

    return json(data)
  },
})
