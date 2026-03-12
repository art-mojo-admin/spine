import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

const ALLOWED_MODELS = new Set(['single', 'multi'])
const ALLOWED_TENANT_TYPES = new Set(['individual', 'organization', 'service_provider'])

interface TenantSettingsBody {
  org_model?: string
  tenant_type?: string
  active_pack_id?: string | null
  installed_packs?: string[]
  metadata?: Record<string, any>
}

interface TenantSettingsRow {
  tenant_account_id: string
  org_model: string | null
  tenant_type: string | null
  installed_packs: string[] | null
  configured_by: string | null
  configured_at: string | null
  metadata: Record<string, any> | null
  active_pack_id: string | null
  workspace_last_purged_at: string | null
  workspace_last_purged_by: string | null
}

const TENANT_TYPE_TO_ORG_MODEL: Record<string, 'single' | 'multi'> = {
  individual: 'single',
  organization: 'multi',
  service_provider: 'multi',
}

function deriveTenantType(row: TenantSettingsRow | null): 'individual' | 'organization' | 'service_provider' {
  if (!row) return 'individual'
  if (row.tenant_type && ALLOWED_TENANT_TYPES.has(row.tenant_type)) {
    return row.tenant_type as 'individual' | 'organization' | 'service_provider'
  }
  return row.org_model === 'multi' ? 'organization' : 'individual'
}

async function loadPersons(personIds: string[]) {
  if (personIds.length === 0) return new Map<string, { id: string; full_name: string | null; email: string | null }>()
  const { data } = await db
    .from('persons')
    .select('id, full_name, email')
    .in('id', personIds)
  const map = new Map<string, { id: string; full_name: string | null; email: string | null }>()
  for (const person of data || []) {
    map.set(person.id, person)
  }
  return map
}

async function serializeSettings(row: TenantSettingsRow | null) {
  const tenantType = deriveTenantType(row)
  const activePackId = row?.active_pack_id ?? null
  const personIds = [row?.configured_by, row?.workspace_last_purged_by].filter((id): id is string => Boolean(id))
  const personMap = await loadPersons(personIds)

  let activePack: { id: string; name: string | null; slug: string | null; icon: string | null } | null = null
  if (activePackId) {
    const { data: pack } = await db
      .from('config_packs')
      .select('id, name, slug, icon')
      .eq('id', activePackId)
      .maybeSingle()
    if (pack) {
      activePack = {
        id: pack.id,
        name: pack.name,
        slug: pack.slug,
        icon: pack.icon,
      }
    }
  }

  return {
    org_model: row?.org_model ?? 'single',
    tenant_type: tenantType,
    installed_packs: row?.installed_packs ?? [],
    configured_at: row?.configured_at ?? null,
    configured_by: row?.configured_by ?? null,
    configured_by_person: row?.configured_by ? personMap.get(row.configured_by) || null : null,
    metadata: row?.metadata ?? {},
    active_pack_id: activePackId,
    active_pack: activePack,
    workspace_last_purged_at: row?.workspace_last_purged_at ?? null,
    workspace_last_purged_by: row?.workspace_last_purged_by ?? null,
    workspace_last_purged_by_person: row?.workspace_last_purged_by ? personMap.get(row.workspace_last_purged_by) || null : null,
  }
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
    const payload = await serializeSettings(settings as TenantSettingsRow | null)
    return json(payload)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<TenantSettingsBody>(req)

    const hasActivePackUpdate = Object.prototype.hasOwnProperty.call(body, 'active_pack_id')

    if (!body.org_model && !body.installed_packs && !body.metadata && !body.tenant_type && !hasActivePackUpdate) {
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

    if (body.tenant_type) {
      if (!ALLOWED_TENANT_TYPES.has(body.tenant_type)) {
        return error('Invalid tenant_type. Use "individual", "organization", or "service_provider".', 422)
      }
      updates.tenant_type = body.tenant_type
      if (!body.org_model) {
        updates.org_model = TENANT_TYPE_TO_ORG_MODEL[body.tenant_type]
      }
    }

    if (hasActivePackUpdate) {
      const nextPackId = body.active_pack_id || null
      if (nextPackId) {
        const { data: activation } = await db
          .from('pack_activations')
          .select('pack_id')
          .eq('account_id', ctx.accountId)
          .eq('pack_id', nextPackId)
          .eq('config_active', true)
          .maybeSingle()
        if (!activation) {
          return error('Pack must be installed and active before selecting it as the workspace context.', 422)
        }
        updates.active_pack_id = activation.pack_id
      } else {
        updates.active_pack_id = null
      }
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
      tenant_type: data.tenant_type,
      installed_packs: data.installed_packs,
      active_pack_id: data.active_pack_id,
    })

    const payload = await serializeSettings(data as TenantSettingsRow)
    return json(payload)
  },
})
