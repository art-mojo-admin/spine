import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

const ADMIN_ONLY = ['admin'] as const

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const itemType = params.get('item_type')
    const ownership = params.get('ownership')

    let query = db
      .from('field_definitions')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('item_type', { ascending: true })
      .order('field_key', { ascending: true })

    if (itemType) query = query.eq('item_type', itemType)
    if (ownership) query = query.eq('ownership', ownership)

    const { data, error: dbErr } = await query
    if (dbErr) return error(dbErr.message, 500)

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY as unknown as string[])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      item_type: string
      field_key: string
      field_type: 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'json' | 'ref'
      field_label: string
      is_required?: boolean
      default_value?: unknown
      validation_rules?: Record<string, unknown>
      display_config?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
      pack_id?: string
    }>(req)

    if (!body.item_type) return error('item_type required')
    if (!body.field_key) return error('field_key required')
    if (!body.field_type) return error('field_type required')
    if (!body.field_label) return error('field_label required')

    const { data, error: dbErr } = await db
      .from('field_definitions')
      .insert({
        account_id: ctx.accountId,
        item_type: body.item_type,
        field_key: body.field_key,
        field_type: body.field_type,
        field_label: body.field_label,
        is_required: body.is_required || false,
        default_value: body.default_value,
        validation_rules: body.validation_rules || {},
        display_config: body.display_config || {},
        ownership: body.ownership || 'tenant',
        pack_id: body.pack_id,
      })
      .select('*')
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') {
        return error('Field already exists for this item type', 409)
      }
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'field_definition', data.id, null, data)
    await emitActivity(
      ctx,
      'field_definition.created',
      `Added field ${body.field_key} to ${body.item_type}`,
      'field_definition',
      data.id,
      { item_type: body.item_type, field_key: body.field_key }
    )

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY as unknown as string[])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('field_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Field definition not found', 404)

    const body = await parseBody<{
      field_label?: string
      field_type?: 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'json' | 'ref'
      is_required?: boolean
      default_value?: unknown
      validation_rules?: Record<string, unknown>
      display_config?: Record<string, unknown>
      ownership?: 'pack' | 'tenant'
    }>(req)

    const updates: Record<string, unknown> = {}
    if (body.field_label !== undefined) updates.field_label = body.field_label
    if (body.field_type !== undefined) updates.field_type = body.field_type
    if (body.is_required !== undefined) updates.is_required = body.is_required
    if (body.default_value !== undefined) updates.default_value = body.default_value
    if (body.validation_rules !== undefined) updates.validation_rules = body.validation_rules
    if (body.display_config !== undefined) updates.display_config = body.display_config
    if (body.ownership !== undefined) updates.ownership = body.ownership

    if (Object.keys(updates).length === 0) return error('No valid fields provided')

    const { data, error: dbErr } = await db
      .from('field_definitions')
      .update(updates)
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .select('*')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'field_definition', id, before, data)
    await emitActivity(
      ctx,
      'field_definition.updated',
      `Updated field ${data.field_key} for ${data.item_type}`,
      'field_definition',
      id,
      { item_type: data.item_type, field_key: data.field_key }
    )

    return json(data)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ADMIN_ONLY as unknown as string[])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('field_definitions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Field definition not found', 404)

    const { error: dbErr } = await db
      .from('field_definitions')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'delete', 'field_definition', id, before, null)
    await emitActivity(
      ctx,
      'field_definition.deleted',
      `Removed field ${before.field_key} from ${before.item_type}`,
      'field_definition',
      id,
      { item_type: before.item_type, field_key: before.field_key }
    )

    return json({ success: true })
  },
})
