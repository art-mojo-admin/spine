import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'
import { adjustCount } from './_shared/counts'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('link_type_definitions')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let query = db
      .from('link_type_definitions')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('name')

    if (!includeInactive) query = query.eq('is_active', true)

    const sourceType = params.get('source_entity_type')
    if (sourceType) query = query.eq('source_entity_type', sourceType)

    const targetType = params.get('target_entity_type')
    if (targetType) query = query.eq('target_entity_type', targetType)

    const { data } = await query
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
    if (!body.name) return error('name is required')

    const slug = body.slug || slugify(body.name)

    const { data: existing } = await db
      .from('link_type_definitions')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('slug', slug)
      .single()

    if (existing) return error(`Link type slug "${slug}" already exists`)

    const { data, error: dbErr } = await db
      .from('link_type_definitions')
      .insert({
        account_id: ctx.accountId,
        name: body.name,
        slug,
        source_entity_type: body.source_entity_type || null,
        target_entity_type: body.target_entity_type || null,
        metadata_schema: body.metadata_schema || {},
        color: body.color || null,
        icon: body.icon || null,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'link_type_definition', data.id, null, data)
    await emitActivity(ctx, 'link_type.created', `Created link type "${data.name}"`, 'link_type_definition', data.id)

    await adjustCount(ctx.accountId!, 'link_types', 1)
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
      .from('link_type_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.source_entity_type !== undefined) updates.source_entity_type = body.source_entity_type
    if (body.target_entity_type !== undefined) updates.target_entity_type = body.target_entity_type
    if (body.metadata_schema !== undefined) updates.metadata_schema = body.metadata_schema
    if (body.color !== undefined) updates.color = body.color
    if (body.icon !== undefined) updates.icon = body.icon

    const { data, error: dbErr } = await db
      .from('link_type_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'link_type_definition', id, before, data)
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
      .from('link_type_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('link_type_definitions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'link_type_definition', id, before, null)
    await emitActivity(ctx, 'link_type.deleted', `Deleted link type "${before.name}"`, 'link_type_definition', id)

    if (before.is_active !== false) await adjustCount(ctx.accountId!, 'link_types', -1)
    return json({ success: true })
  },
})
