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
        .from('custom_field_definitions')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let query = db
      .from('custom_field_definitions')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('entity_type')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (!includeInactive) query = query.eq('is_active', true)

    const entityType = params.get('entity_type')
    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

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
    if (!body.name || !body.entity_type || !body.field_type) {
      return error('name, entity_type, and field_type required')
    }

    const fieldKey = body.field_key || slugify(body.name)

    const { data: existing } = await db
      .from('custom_field_definitions')
      .select('id')
      .eq('account_id', ctx.accountId)
      .eq('entity_type', body.entity_type)
      .eq('field_key', fieldKey)
      .single()

    if (existing) {
      return error(`Field key "${fieldKey}" already exists for ${body.entity_type}`)
    }

    const { data, error: dbErr } = await db
      .from('custom_field_definitions')
      .insert({
        account_id: ctx.accountId,
        entity_type: body.entity_type,
        name: body.name,
        field_key: fieldKey,
        field_type: body.field_type,
        options: body.options || [],
        required: body.required || false,
        default_value: body.default_value || null,
        section: body.section || null,
        position: body.position ?? 0,
        enabled: body.enabled !== false,
        is_public: body.is_public || false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'custom_field_definition', data.id, null, data)
    await emitActivity(ctx, 'custom_field.created', `Created custom field "${data.name}" for ${data.entity_type}`, 'custom_field_definition', data.id)

    if (data.enabled !== false) await adjustCount(ctx.accountId!, 'custom_fields', 1)
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
      .from('custom_field_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.field_type !== undefined) updates.field_type = body.field_type
    if (body.options !== undefined) updates.options = body.options
    if (body.required !== undefined) updates.required = body.required
    if (body.default_value !== undefined) updates.default_value = body.default_value
    if (body.section !== undefined) updates.section = body.section
    if (body.position !== undefined) updates.position = body.position
    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.is_public !== undefined) updates.is_public = body.is_public

    const { data, error: dbErr } = await db
      .from('custom_field_definitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    if (body.enabled !== undefined && before.enabled !== data.enabled) {
      await adjustCount(ctx.accountId!, 'custom_fields', data.enabled ? 1 : -1)
    }
    await emitAudit(ctx, 'update', 'custom_field_definition', id, before, data)
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
      .from('custom_field_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('custom_field_definitions').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'custom_field_definition', id, before, null)
    await emitActivity(ctx, 'custom_field.deleted', `Deleted custom field "${before.name}"`, 'custom_field_definition', id)

    if (before.enabled !== false) await adjustCount(ctx.accountId!, 'custom_fields', -1)
    return json({ success: true })
  },
})
