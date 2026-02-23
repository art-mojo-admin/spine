import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'
import { nextCronDate } from './_shared/cron'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('scheduled_triggers')
        .select('*, created_by_person:created_by(id, full_name)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)

      // Include recent instances
      const { data: instances } = await db
        .from('scheduled_trigger_instances')
        .select('*')
        .eq('trigger_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      return json({ ...data, instances: instances || [] })
    }

    const { data } = await db
      .from('scheduled_triggers')
      .select('*, created_by_person:created_by(id, full_name)')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .limit(200)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.name || !body.trigger_type || !body.action_type) {
      return error('name, trigger_type, and action_type required')
    }

    const row: Record<string, any> = {
      account_id: ctx.accountId,
      name: body.name,
      trigger_type: body.trigger_type,
      action_type: body.action_type,
      action_config: body.action_config || {},
      conditions: body.conditions || [],
      enabled: body.enabled !== false,
      created_by: ctx.personId,
    }

    if (body.trigger_type === 'one_time') {
      if (!body.fire_at) return error('fire_at required for one_time triggers')
      row.fire_at = body.fire_at
    } else if (body.trigger_type === 'recurring') {
      if (!body.cron_expression) return error('cron_expression required for recurring triggers')
      row.cron_expression = body.cron_expression
      try {
        row.next_fire_at = nextCronDate(body.cron_expression).toISOString()
      } catch (e: any) {
        return error(`Invalid cron expression: ${e.message}`)
      }
    } else if (body.trigger_type === 'countdown') {
      if (!body.delay_seconds || !body.delay_event) {
        return error('delay_seconds and delay_event required for countdown triggers')
      }
      row.delay_seconds = body.delay_seconds
      row.delay_event = body.delay_event
    }

    const { data, error: dbErr } = await db
      .from('scheduled_triggers')
      .insert(row)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'scheduled_trigger', data.id, null, data)
    await emitActivity(ctx, 'scheduled_trigger.created', `Created trigger "${data.name}"`, 'scheduled_trigger', data.id)

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('scheduled_triggers')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = body.name
    if (body.action_type !== undefined) updates.action_type = body.action_type
    if (body.action_config !== undefined) updates.action_config = body.action_config
    if (body.conditions !== undefined) updates.conditions = body.conditions
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.fire_at !== undefined) updates.fire_at = body.fire_at
    if (body.delay_seconds !== undefined) updates.delay_seconds = body.delay_seconds
    if (body.delay_event !== undefined) updates.delay_event = body.delay_event

    if (body.cron_expression !== undefined) {
      updates.cron_expression = body.cron_expression
      try {
        updates.next_fire_at = nextCronDate(body.cron_expression).toISOString()
      } catch (e: any) {
        return error(`Invalid cron expression: ${e.message}`)
      }
    }

    const { data, error: dbErr } = await db
      .from('scheduled_triggers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'scheduled_trigger', id, before, data)
    await emitActivity(ctx, 'scheduled_trigger.updated', `Updated trigger "${data.name}"`, 'scheduled_trigger', id)

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
      .from('scheduled_triggers')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('scheduled_triggers').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'scheduled_trigger', id, before, null)
    await emitActivity(ctx, 'scheduled_trigger.deleted', `Deleted trigger "${before.name}"`, 'scheduled_trigger', id)

    return json({ success: true })
  },
})
