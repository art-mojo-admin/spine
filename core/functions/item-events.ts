import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const itemId = params.get('item_id')
    const eventType = params.get('event_type')
    const limit = parseInt(params.get('limit') || '100')
    const offset = parseInt(params.get('offset') || '0')

    let query = db
      .from('item_events')
      .select(`
        *,
        principals:actor_principal_id (
          id,
          principal_type,
          display_name,
          status
        )
      `)
      .eq('account_id', ctx.accountId)
      .order('sequence_number', { ascending: false })

    if (itemId) query = query.eq('item_id', itemId)
    if (eventType) query = query.eq('event_type', eventType)
    if (limit > 0) query = query.limit(limit)
    if (offset > 0) query = query.range(offset, offset + limit - 1)

    const { data, error: dbErr } = await query
    if (dbErr) return error(dbErr.message, 500)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      item_id: string
      event_type: string
      event_data?: Record<string, unknown>
      actor_principal_id?: string
    }>(req)

    if (!body.item_id) return error('item_id required')
    if (!body.event_type) return error('event_type required')

    // Verify item exists and belongs to account
    const { data: item } = await db
      .from('items')
      .select('id')
      .eq('id', body.item_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!item) return error('Item not found', 404)

    // Resolve actor principal if not provided
    let actorPrincipalId = body.actor_principal_id
    if (!actorPrincipalId) {
      const { data: principal } = await db
        .from('principals')
        .select('id')
        .eq('person_id', ctx.personId)
        .single()
      actorPrincipalId = principal?.id
    }

    const { data, error: dbErr } = await db
      .from('item_events')
      .insert({
        account_id: ctx.accountId,
        item_id: body.item_id,
        event_type: body.event_type,
        event_data: body.event_data || {},
        actor_principal_id: actorPrincipalId,
      })
      .select(`
        *,
        principals:actor_principal_id (
          id,
          principal_type,
          display_name,
          status
        )
      `)
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'item_event', data.id, null, data)
    await emitActivity(
      ctx,
      'item_event.created',
      `Event ${body.event_type} recorded for item`,
      'item_event',
      data.id,
      { item_id: body.item_id, event_type: body.event_type }
    )

    return json(data, 201)
  },
})
