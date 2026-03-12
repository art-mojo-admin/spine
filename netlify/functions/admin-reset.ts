import {
  createHandler,
  requireAuth,
  requireTenant,
  parseBody,
  json,
  error,
  type RequestContext,
} from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity, emitAudit } from './_shared/audit'
import { recalcAllCounts } from './_shared/counts'
import { uninstallPack } from './config-packs'

interface ResetBody {
  confirmation?: string
  notes?: string
}

const SYSTEM_ROLES = new Set(['system_admin', 'system_operator'])

const ACCOUNT_TABLES: { table: string; column?: string }[] = [
  { table: 'items' },
  { table: 'entity_links' },
  { table: 'threads' },
  { table: 'scheduled_trigger_instances' },
  { table: 'scheduled_triggers' },
  { table: 'automation_rules' },
  { table: 'custom_field_definitions' },
  { table: 'link_type_definitions' },
  { table: 'view_definitions' },
  { table: 'app_definitions' },
  { table: 'account_modules' },
  { table: 'custom_action_types' },
  { table: 'integration_instances' },
  { table: 'inbound_webhook_mappings' },
  { table: 'inbound_webhook_keys' },
  { table: 'webhook_deliveries' },
  { table: 'webhook_subscriptions' },
  { table: 'outbox_events' },
  { table: 'machine_principals' },
  { table: 'principal_scopes' },
  { table: 'account_scopes' },
  { table: 'activity_events' },
  { table: 'audit_log' },
  { table: 'error_events' },
  { table: 'metrics_snapshots' },
  { table: 'admin_counts' },
  { table: 'workflow_definitions' },
]

function requireSystemAdmin(ctx: RequestContext) {
  if (!ctx.systemRole || !SYSTEM_ROLES.has(ctx.systemRole)) {
    return error('System admin role required', 403)
  }
  return null
}

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const systemRoleCheck = requireSystemAdmin(ctx)
    if (systemRoleCheck) return systemRoleCheck

    const body = await parseBody<ResetBody>(req)
    const requiredToken = `PURGE-${ctx.accountId}`.toUpperCase()
    const provided = body.confirmation?.trim().toUpperCase()
    if (provided !== requiredToken) {
      return error('Confirmation token mismatch. Type the provided PURGE token to continue.', 422)
    }

    const accountId = ctx.accountId!

    const { data: installedPacks } = await db
      .from('pack_activations')
      .select('pack_id')
      .eq('account_id', accountId)

    if (installedPacks) {
      for (const activation of installedPacks) {
        if (!activation?.pack_id) continue
        await uninstallPack(accountId, activation.pack_id)
      }
    }

    await db.from('pack_activations').delete().eq('account_id', accountId)
    await db.from('pack_entity_mappings').delete().eq('account_id', accountId)

    for (const { table, column = 'account_id' } of ACCOUNT_TABLES) {
      try {
        await db.from(table).delete().eq(column, accountId)
      } catch (err) {
        console.error(`[admin-reset] Failed deleting from ${table}`, err)
        throw err
      }
    }

    const now = new Date().toISOString()
    const settingsUpdate = {
      installed_packs: [],
      active_pack_id: null,
      workspace_last_purged_at: now,
      workspace_last_purged_by: ctx.personId,
    }

    const { data: existingSettings } = await db
      .from('tenant_settings')
      .select('tenant_account_id')
      .eq('tenant_account_id', accountId)
      .maybeSingle()

    if (existingSettings) {
      await db
        .from('tenant_settings')
        .update(settingsUpdate)
        .eq('tenant_account_id', accountId)
    } else {
      await db
        .from('tenant_settings')
        .insert({
          tenant_account_id: accountId,
          org_model: 'single',
          tenant_type: 'individual',
          ...settingsUpdate,
        })
    }

    await recalcAllCounts(accountId)

    await emitAudit(ctx, 'tenant_workspace.purged', 'account', accountId, null, {
      notes: body.notes ?? null,
      purged_at: now,
    })
    await emitActivity(
      ctx,
      'tenant_workspace.purged',
      'Workspace purged to a fresh state',
      'account',
      accountId,
      { notes: body.notes ?? null },
    )

    return json({ success: true, purged_at: now })
  },
})
