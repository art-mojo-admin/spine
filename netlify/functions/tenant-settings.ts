import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

const ALLOWED_MODELS = new Set(['single', 'multi'])

interface TenantSettingsBody {
  org_model?: string
  installed_packs?: string[]
  metadata?: Record<string, any>
}

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const { data: settings } = await db
      .from('tenant_settings')
      .select('*')
      .eq('tenant_account_id', ctx.accountId)
      .maybeSingle()

    let configuredByPerson: { id: string; full_name: string | null; email: string | null } | null = null
    if (settings?.configured_by) {
      const { data: person } = await db
        .from('persons')
        .select('id, full_name, email')
        .eq('id', settings.configured_by)
        .maybeSingle()
      configuredByPerson = person || null
    }

    return json({
      org_model: settings?.org_model ?? 'single',
      installed_packs: settings?.installed_packs ?? [],
      configured_at: settings?.configured_at ?? null,
      configured_by: settings?.configured_by ?? null,
      configured_by_person: configuredByPerson,
      metadata: settings?.metadata ?? {},
    })
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<TenantSettingsBody>(req)

    if (!body.org_model && !body.installed_packs && !body.metadata) {
      return error('No fields to update', 400)
    }

    const updates: Record<string, any> = { tenant_account_id: ctx.accountId }

    if (body.org_model) {
      if (!ALLOWED_MODELS.has(body.org_model)) {
        return error('Invalid org_model. Use "single" or "multi".', 422)
      }
      updates.org_model = body.org_model
    }

    if (body.installed_packs) {
      if (!Array.isArray(body.installed_packs)) {
        return error('installed_packs must be an array', 422)
      }
      const cleaned = Array.from(new Set(body.installed_packs.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)))
      updates.installed_packs = cleaned
    }

    if (body.metadata) {
      updates.metadata = body.metadata
    }

    const now = new Date().toISOString()
    updates.configured_at = now
    updates.configured_by = ctx.personId

    const { data: before } = await db
      .from('tenant_settings')
      .select('*')
      .eq('tenant_account_id', ctx.accountId)
      .maybeSingle()

    const { data, error: dbErr } = await db
      .from('tenant_settings')
      .upsert(updates, { onConflict: 'tenant_account_id' })
      .select('*')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'tenant_settings.updated', 'tenant_settings', ctx.accountId!, before, data)
    await emitActivity(ctx, 'tenant_settings.updated', 'Updated tenant configuration', 'tenant_settings', ctx.accountId!, {
      org_model: data.org_model,
      installed_packs: data.installed_packs,
    })

    return json({
      org_model: data.org_model,
      installed_packs: data.installed_packs,
      configured_at: data.configured_at,
      configured_by: data.configured_by,
      metadata: data.metadata,
    })
  },
})
