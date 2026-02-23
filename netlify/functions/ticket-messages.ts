import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const ticketId = params.get('ticket_id')
    if (!ticketId) return error('ticket_id required')

    const { data: ticket } = await db.from('tickets').select('id').eq('id', ticketId).eq('account_id', ctx.accountId).single()
    if (!ticket) return error('Ticket not found', 404)

    const { data } = await db
      .from('ticket_messages')
      .select('*, persons:person_id(id, full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{ ticket_id: string; body: string; is_internal?: boolean }>(req)
    if (!body.ticket_id || !body.body) return error('ticket_id and body required')

    const { data: ticket } = await db.from('tickets').select('id, subject').eq('id', body.ticket_id).eq('account_id', ctx.accountId).single()
    if (!ticket) return error('Ticket not found', 404)

    const { data, error: dbErr } = await db
      .from('ticket_messages')
      .insert({
        ticket_id: body.ticket_id,
        person_id: ctx.personId,
        body: body.body,
        is_internal: body.is_internal || false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'ticket_message', data.id, null, data)
    await emitActivity(ctx, 'ticket.replied', `Replied to ticket "${ticket.subject}"`, 'ticket', body.ticket_id)
    await emitOutboxEvent(ctx.accountId!, 'ticket.replied', 'ticket', body.ticket_id, data)

    return json(data, 201)
  },
})
