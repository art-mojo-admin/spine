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
import { uninstallPack } from './config-packs'

interface ResetBody {
  confirmation?: string
  notes?: string
}

const SYSTEM_ROLES = new Set(['system_admin', 'system_operator'])

const ACCOUNT_TABLES: { table: string; column?: string }[] = [
  { table: 'items' },
  { table: 'item_links' },
  { table: 'item_events' },
  { table: 'threads' },
  { table: 'messages' },
  { table: 'embeddings' },
  { table: 'field_definitions' },
  { table: 'link_type_definitions' },
  { table: 'item_type_registry' },
  { table: 'view_definitions' },
  { table: 'app_definitions' },
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
  { table: 'audit_log' },
  { table: 'error_events' },
  { table: 'scheduled_trigger_instances' },
  { table: 'scheduled_triggers' },
  { table: 'automation_rules' },
  // Phase D tables
  { table: 'agent_contracts' },
  { table: 'agent_executions' },
  { table: 'agent_capabilities' },
  { table: 'agent_contract_capabilities' },
  { table: 'extension_surfaces' },
  { table: 'helper_utilities' },
  // Phase E tables
  { table: 'admin_audit_views' },
  { table: 'admin_alerts' },
  { table: 'admin_health_snapshots' },
  // Phase C tables
  { table: 'installed_packs' },
  { table: 'pack_install_history' },
  { table: 'pack_dependencies' },
  { table: 'pack_rollback_snapshots' },
  { table: 'local_pack_manifests' },
  // Legacy workflow tables (deferred removal)
  { table: 'workflow_definitions' },
  { table: 'stage_definitions' },
  { table: 'transition_definitions' },
  { table: 'workflow_actions' },
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
      .from('installed_packs')
      .select('pack_name')
      .eq('account_id', accountId)

    if (installedPacks) {
      for (const installed of installedPacks) {
        if (!installed?.pack_name) continue
        await uninstallPack(accountId, installed.pack_name)
      }
    }

    await db.from('installed_packs').delete().eq('account_id', accountId)

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

    // Counts recalculations removed - admin_counts table dropped

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
