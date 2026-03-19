import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const sourceItemId = params.get('source_item_id')
    const targetItemId = params.get('target_item_id')
    const linkType = params.get('link_type')
    const limit = parseInt(params.get('limit') || '100')
    const offset = parseInt(params.get('offset') || '0')

    let query = db
      .from('item_links')
      .select(`
        *,
        source_items:source_item_id (
          id,
          title,
          slug,
          item_type,
          status
        ),
        target_items:target_item_id (
          id,
          title,
          slug,
          item_type,
          status
        ),
        principals:created_by_principal_id (
          id,
          principal_type,
          display_name,
          status
        )
      `)
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (sourceItemId) query = query.eq('source_item_id', sourceItemId)
    if (targetItemId) query = query.eq('target_item_id', targetItemId)
    if (linkType) query = query.eq('link_type', linkType)
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
      source_item_id: string
      target_item_id: string
      link_type: string
      sequence?: number
      metadata?: Record<string, unknown>
    }>(req)

    if (!body.source_item_id) return error('source_item_id required')
    if (!body.target_item_id) return error('target_item_id required')
    if (!body.link_type) return error('link_type required')

    // Verify both items exist and belong to account
    const { data: sourceItem } = await db
      .from('items')
      .select('id')
      .eq('id', body.source_item_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!sourceItem) return error('Source item not found', 404)

    const { data: targetItem } = await db
      .from('items')
      .select('id')
      .eq('id', body.target_item_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!targetItem) return error('Target item not found', 404)

    // Resolve creating principal
    const { data: principal } = await db
      .from('principals')
      .select('id')
      .eq('person_id', ctx.personId)
      .single()

    const { data, error: dbErr } = await db
      .from('item_links')
      .insert({
        account_id: ctx.accountId,
        source_item_id: body.source_item_id,
        target_item_id: body.target_item_id,
        link_type: body.link_type,
        sequence: body.sequence,
        metadata: body.metadata || {},
        created_by_principal_id: principal?.id,
      })
      .select(`
        *,
        source_items:source_item_id (
          id,
          title,
          slug,
          item_type,
          status
        ),
        target_items:target_item_id (
          id,
          title,
          slug,
          item_type,
          status
        ),
        principals:created_by_principal_id (
          id,
          principal_type,
          display_name,
          status
        )
      `)
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') {
        return error('Link already exists', 409)
      }
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'item_link', data.id, null, data)
    await emitActivity(
      ctx,
      'item_link.created',
      `Linked ${body.link_type} between items`,
      'item_link',
      data.id,
      { source_item_id: body.source_item_id, target_item_id: body.target_item_id, link_type: body.link_type }
    )

    return json(data, 201)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('item_links')
      .select('*, source_items:source_item_id (title), target_items:target_item_id (title)')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Link not found', 404)

    const { error: dbErr } = await db
      .from('item_links')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'delete', 'item_link', id, before, null)
    await emitActivity(
      ctx,
      'item_link.deleted',
      `Removed ${before.link_type} link between items`,
      'item_link',
      id,
      { link_type: before.link_type }
    )

    return json({ success: true })
  },
})
