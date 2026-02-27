import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('integration_instances')
        .select('*, integration_definitions(id, slug, name, icon, category, version, manifest)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const limit = clampLimit(params)
    const { data } = await db
      .from('integration_instances')
      .select('*, integration_definitions(id, slug, name, icon, category, version)')
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit)

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
    const action = body.action

    // ── Install ────────────────────────────────────────────────────────
    if (action === 'install') {
      if (!body.definition_id) return error('definition_id required')

      const { data: def } = await db
        .from('integration_definitions')
        .select('*')
        .eq('id', body.definition_id)
        .single()

      if (!def) return error('Integration definition not found', 404)

      // Check if already installed
      const { data: existing } = await db
        .from('integration_instances')
        .select('id, status')
        .eq('account_id', ctx.accountId)
        .eq('definition_id', body.definition_id)
        .maybeSingle()

      if (existing) return error('Integration already installed', 409)

      const { data: instance, error: dbErr } = await db
        .from('integration_instances')
        .insert({
          account_id: ctx.accountId,
          definition_id: body.definition_id,
          status: 'installed',
          config: body.config || {},
          auth_config: body.auth_config || {},
        })
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)

      // Auto-provision inbound keys from manifest
      const manifest = def.manifest || {}
      if (manifest.inbound_endpoints?.length > 0) {
        for (const endpoint of manifest.inbound_endpoints) {
          const apiKey = `spn_${crypto.randomUUID().replace(/-/g, '')}`
          await db.from('inbound_webhook_keys').insert({
            account_id: ctx.accountId,
            name: `${def.name} - ${endpoint.name}`,
            api_key: apiKey,
            enabled: true,
            integration_instance_id: instance.id,
          })
        }
      }

      await emitActivity(ctx, 'integration.installed', `Installed integration "${def.name}"`, 'integration', instance.id)
      return json(instance, 201)
    }

    // ── Enable ─────────────────────────────────────────────────────────
    if (action === 'enable') {
      if (!body.id) return error('id required')

      const { data, error: dbErr } = await db
        .from('integration_instances')
        .update({ status: 'enabled' })
        .eq('id', body.id)
        .eq('account_id', ctx.accountId)
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)
      if (!data) return error('Not found', 404)

      // Enable linked inbound keys
      await db.from('inbound_webhook_keys')
        .update({ enabled: true })
        .eq('integration_instance_id', body.id)

      // Enable linked webhook subscriptions
      await db.from('webhook_subscriptions')
        .update({ enabled: true })
        .eq('integration_instance_id', body.id)

      await emitActivity(ctx, 'integration.enabled', `Enabled integration`, 'integration', body.id)
      return json(data)
    }

    // ── Disable ────────────────────────────────────────────────────────
    if (action === 'disable') {
      if (!body.id) return error('id required')

      const { data, error: dbErr } = await db
        .from('integration_instances')
        .update({ status: 'disabled' })
        .eq('id', body.id)
        .eq('account_id', ctx.accountId)
        .select()
        .single()

      if (dbErr) return error(dbErr.message, 500)
      if (!data) return error('Not found', 404)

      // Disable linked inbound keys
      await db.from('inbound_webhook_keys')
        .update({ enabled: false })
        .eq('integration_instance_id', body.id)

      // Disable linked webhook subscriptions
      await db.from('webhook_subscriptions')
        .update({ enabled: false })
        .eq('integration_instance_id', body.id)

      await emitActivity(ctx, 'integration.disabled', `Disabled integration`, 'integration', body.id)
      return json(data)
    }

    // ── Uninstall ──────────────────────────────────────────────────────
    if (action === 'uninstall') {
      if (!body.id) return error('id required')

      // Disable all linked resources first
      await db.from('inbound_webhook_keys')
        .update({ enabled: false })
        .eq('integration_instance_id', body.id)

      await db.from('webhook_subscriptions')
        .update({ enabled: false })
        .eq('integration_instance_id', body.id)

      const { error: dbErr } = await db
        .from('integration_instances')
        .update({ status: 'disabled', is_active: false })
        .eq('id', body.id)
        .eq('account_id', ctx.accountId)

      if (dbErr) return error(dbErr.message, 500)

      await emitActivity(ctx, 'integration.uninstalled', `Uninstalled integration`, 'integration', body.id)
      return json({ success: true })
    }

    return error('Unknown action. Use install, enable, disable, or uninstall')
  },
})
