import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

const VALID_ENTITY_TYPES = ['person', 'account', 'workflow_item', 'ticket', 'kb_article']

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('entity_links')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    // Query links where entity is source OR target (bidirectional)
    const entityType = params.get('entity_type')
    const entityId = params.get('entity_id')
    const linkType = params.get('link_type')
    const direction = params.get('direction') // 'source', 'target', or null (both)

    if (!entityType || !entityId) {
      return error('entity_type and entity_id are required')
    }

    let results: any[] = []

    if (!direction || direction === 'source') {
      let q = db
        .from('entity_links')
        .select('*')
        .eq('account_id', ctx.accountId)
        .eq('source_type', entityType)
        .eq('source_id', entityId)
      if (linkType) q = q.eq('link_type', linkType)
      const { data } = await q.order('created_at', { ascending: false })
      if (data) results.push(...data.map((d: any) => ({ ...d, _direction: 'outgoing' })))
    }

    if (!direction || direction === 'target') {
      let q = db
        .from('entity_links')
        .select('*')
        .eq('account_id', ctx.accountId)
        .eq('target_type', entityType)
        .eq('target_id', entityId)
      if (linkType) q = q.eq('link_type', linkType)
      const { data } = await q.order('created_at', { ascending: false })
      if (data) results.push(...data.map((d: any) => ({ ...d, _direction: 'incoming' })))
    }

    // Deduplicate by id (in case same link appears in both directions query)
    const seen = new Set<string>()
    results = results.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    return json(results)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<any>(req)

    if (!body.source_type || !body.source_id || !body.target_type || !body.target_id) {
      return error('source_type, source_id, target_type, and target_id are required')
    }

    if (!VALID_ENTITY_TYPES.includes(body.source_type) || !VALID_ENTITY_TYPES.includes(body.target_type)) {
      return error(`entity types must be one of: ${VALID_ENTITY_TYPES.join(', ')}`)
    }

    const linkType = body.link_type || 'related'

    const { data, error: dbErr } = await db
      .from('entity_links')
      .insert({
        account_id: ctx.accountId,
        source_type: body.source_type,
        source_id: body.source_id,
        target_type: body.target_type,
        target_id: body.target_id,
        link_type: linkType,
        metadata: body.metadata || {},
        created_by: ctx.personId,
      })
      .select()
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('This link already exists', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'entity_link', data.id, null, data)
    await emitActivity(
      ctx,
      'entity_link.created',
      `Linked ${body.source_type} to ${body.target_type} (${linkType})`,
      'entity_link',
      data.id,
      { source_type: body.source_type, source_id: body.source_id, target_type: body.target_type, target_id: body.target_id, link_type: linkType },
    )
    await emitOutboxEvent(ctx.accountId!, 'entity_link.created', 'entity_link', data.id, {
      link: data,
    })

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('entity_links')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.link_type !== undefined) updates.link_type = body.link_type
    if (body.metadata !== undefined) updates.metadata = body.metadata

    if (Object.keys(updates).length === 0) return error('No fields to update')

    const { data, error: dbErr } = await db
      .from('entity_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'entity_link', id, before, data)
    return json(data)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('entity_links')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('entity_links').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'entity_link', id, before, null)
    await emitActivity(
      ctx,
      'entity_link.deleted',
      `Removed link ${before.source_type} → ${before.target_type} (${before.link_type})`,
      'entity_link',
      id,
    )
    await emitOutboxEvent(ctx.accountId!, 'entity_link.deleted', 'entity_link', id, {
      link: before,
    })

    return json({ success: true })
  },
})
