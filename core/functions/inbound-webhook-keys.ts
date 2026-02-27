import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'
import { maskApiKey } from './_shared/security'
import crypto from 'crypto'

function generateApiKey(): string {
  return 'spn_' + crypto.randomBytes(32).toString('hex')
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
        .from('inbound_webhook_keys')
        .select('*')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json({ ...data, api_key: maskApiKey(data.api_key) })
    }

    const { data } = await db
      .from('inbound_webhook_keys')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    const masked = (data || []).map((k: any) => ({ ...k, api_key: maskApiKey(k.api_key) }))
    return json(masked)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.name) return error('name required')

    const apiKey = generateApiKey()

    const { data, error: dbErr } = await db
      .from('inbound_webhook_keys')
      .insert({
        account_id: ctx.accountId,
        name: body.name,
        api_key: apiKey,
        enabled: body.enabled !== false,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'inbound_webhook_key', data.id, null, data)
    await emitActivity(ctx, 'inbound_webhook_key.created', `Created API key "${data.name}"`, 'inbound_webhook_key', data.id)

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
      .from('inbound_webhook_keys')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.enabled !== undefined) updates.enabled = body.enabled

    const { data, error: dbErr } = await db
      .from('inbound_webhook_keys')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'inbound_webhook_key', id, before, data)
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
      .from('inbound_webhook_keys')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    await db.from('inbound_webhook_keys').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'inbound_webhook_key', id, before, null)
    await emitActivity(ctx, 'inbound_webhook_key.deleted', `Deleted API key "${before.name}"`, 'inbound_webhook_key', id)

    return json({ success: true })
  },
})
