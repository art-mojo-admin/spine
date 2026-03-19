import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const mode = params.get('mode') as 'overview' | 'health' | 'alerts' | 'widgets' | 'snapshots'
    const timeframe = params.get('timeframe') || '24h'

    try {
      let result

      switch (mode) {
        case 'health':
          result = await getSystemHealth(ctx.accountId!)
          break
        case 'alerts':
          result = await getAdminAlerts(ctx.accountId!)
          break
        case 'widgets':
          result = await getDashboardWidgets(ctx.accountId!)
          break
        case 'snapshots':
          result = await getHealthSnapshots(ctx.accountId!, timeframe)
          break
        case 'overview':
        default:
          result = await getDashboardOverview(ctx.accountId!)
          break
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Admin dashboard query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      widget_type: 'metric' | 'chart' | 'table' | 'alert' | 'health' | 'activity'
      widget_name: string
      data_source: string
      widget_config?: Record<string, unknown>
      refresh_interval?: number
      position_x?: number
      position_y?: number
      width?: number
      height?: number
    }>(req)

    if (!body.widget_type) return error('widget_type required')
    if (!body.widget_name) return error('widget_name required')
    if (!body.data_source) return error('data_source required')

    try {
      const result = await createDashboardWidget(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Dashboard widget creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const widgetId = params.get('widget_id')
    if (!widgetId) return error('widget_id required')

    const body = await parseBody<{
      widget_name?: string
      widget_config?: Record<string, unknown>
      refresh_interval?: number
      position_x?: number
      position_y?: number
      width?: number
      height?: number
      is_visible?: boolean
    }>(req)

    try {
      const result = await updateDashboardWidget(ctx, widgetId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Dashboard widget update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const widgetId = params.get('widget_id')
    if (!widgetId) return error('widget_id required')

    try {
      await deleteDashboardWidget(ctx, widgetId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Dashboard widget deletion failed', 500)
    }
  },
})

async function getDashboardOverview(accountId: string) {
  const { data } = await db.rpc('get_admin_dashboard_data', {
    dashboard_account_id: accountId
  })

  return data || {}
}

async function getSystemHealth(accountId: string) {
  const { data } = await db.rpc('get_admin_system_health', {
    health_account_id: accountId
  })

  return data || {}
}

async function getAdminAlerts(accountId: string) {
  const { data } = await db
    .from('admin_alerts')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })

  return data || []
}

async function getDashboardWidgets(accountId: string) {
  const { data } = await db
    .from('admin_dashboard_widgets')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_visible', true)
    .order('position_y', { ascending: true })
    .order('position_x', { ascending: true })

  return data || []
}

async function getHealthSnapshots(accountId: string, timeframe: string) {
  let interval: string
  switch (timeframe) {
    case '7d':
      interval = '7 days'
      break
    case '30d':
      interval = '30 days'
      break
    default:
      interval = '24 hours'
  }

  const { data } = await db
    .from('admin_health_snapshots')
    .select('*')
    .eq('account_id', accountId)
    .eq('snapshot_type', 'hourly')
    .gte('snapshot_timestamp', new Date(Date.now() - Date.parse(interval)))
    .order('snapshot_timestamp', { ascending: false })

  return data || []
}

async function createDashboardWidget(ctx: any, body: any) {
  // Resolve creating principal
  const { data: principal } = await db
    .from('principals')
    .select('id')
    .eq('person_id', ctx.personId)
    .single()

  const { data } = await db
    .from('admin_dashboard_widgets')
    .insert({
      account_id: ctx.accountId,
      widget_type: body.widget_type,
      widget_name: body.widget_name,
      data_source: body.data_source,
      widget_config: body.widget_config || {},
      refresh_interval: body.refresh_interval || 300,
      position_x: body.position_x || 0,
      position_y: body.position_y || 0,
      width: body.width || 4,
      height: body.height || 3,
      created_by_principal_id: principal?.id
    })
    .select()
    .single()

  if (!data) throw new Error('Failed to create dashboard widget')

  await emitAudit(ctx, 'create', 'admin_dashboard_widget', data.id, null, body)
  await emitActivity(ctx, 'admin_dashboard_widget.created', `Created dashboard widget ${body.widget_name}`, 'admin_dashboard_widget', data.id)

  return {
    widget_id: data.id,
    widget_name: body.widget_name,
    message: 'Dashboard widget created successfully'
  }
}

async function updateDashboardWidget(ctx: any, widgetId: string, updates: any) {
  const { data: before } = await db
    .from('admin_dashboard_widgets')
    .select('*')
    .eq('id', widgetId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Dashboard widget not found')

  const updateData: Record<string, unknown> = {}
  if (updates.widget_name) updateData.widget_name = updates.widget_name
  if (updates.widget_config) updateData.widget_config = updates.widget_config
  if (updates.refresh_interval) updateData.refresh_interval = updates.refresh_interval
  if (updates.position_x !== undefined) updateData.position_x = updates.position_x
  if (updates.position_y !== undefined) updateData.position_y = updates.position_y
  if (updates.width) updateData.width = updates.width
  if (updates.height) updateData.height = updates.height
  if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible

  const { data } = await db
    .from('admin_dashboard_widgets')
    .update(updateData)
    .eq('id', widgetId)
    .eq('account_id', ctx.accountId)
    .select()
    .single()

  if (!data) throw new Error('Failed to update dashboard widget')

  await emitAudit(ctx, 'update', 'admin_dashboard_widget', widgetId, before, data)
  await emitActivity(ctx, 'admin_dashboard_widget.updated', `Updated dashboard widget ${data.widget_name}`, 'admin_dashboard_widget', widgetId)

  return data
}

async function deleteDashboardWidget(ctx: any, widgetId: string) {
  const { data: before } = await db
    .from('admin_dashboard_widgets')
    .select('*')
    .eq('id', widgetId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Dashboard widget not found')

  const { error } = await db
    .from('admin_dashboard_widgets')
    .delete()
    .eq('id', widgetId)
    .eq('account_id', ctx.accountId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'admin_dashboard_widget', widgetId, before, null)
  await emitActivity(ctx, 'admin_dashboard_widget.deleted', `Deleted dashboard widget ${before.widget_name}`, 'admin_dashboard_widget', widgetId)
}

export async function createSystemAlert(
  ctx: any,
  alertType: string,
  severity: string,
  title: string,
  message?: string,
  data?: Record<string, unknown>,
  sourceEntityType?: string,
  sourceEntityId?: string
) {
  const { data: alert } = await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: alertType,
    alert_severity: severity,
    alert_title: title,
    alert_message: message || null,
    alert_data: data || {},
    source_entity_type: sourceEntityType || null,
    source_entity_id: sourceEntityId || null
  })

  return alert
}

export async function resolveSystemAlert(ctx: any, alertId: string) {
  // Resolve principal
  const { data: principal } = await db
    .from('principals')
    .select('id')
    .eq('person_id', ctx.personId)
    .single()

  if (!principal) throw new Error('Principal not found')

  const success = await db.rpc('resolve_admin_alert', {
    alert_id: alertId,
    resolving_principal_id: principal.id
  })

  if (success) {
    await emitAudit(ctx, 'update', 'admin_alert', alertId, null, { resolved: true })
    await emitActivity(ctx, 'admin_alert.resolved', `Resolved system alert`, 'admin_alert', alertId)
  }

  return { success }
}

export async function getWidgetData(ctx: any, widgetId: string) {
  const { data: widget } = await db
    .from('admin_dashboard_widgets')
    .select('*')
    .eq('id', widgetId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!widget) throw new Error('Widget not found')

  // Get data based on widget data source
  let data: any = {}

  switch (widget.data_source) {
    case 'system_health':
      data = await getSystemHealth(ctx.accountId!)
      break
    case 'admin_alerts':
      data = await getAdminAlerts(ctx.accountId!)
      break
    case 'type_registry':
      data = await getTypeRegistrySummary(ctx.accountId!)
      break
    case 'pack_lifecycle':
      data = await getPackLifecycleSummary(ctx.accountId!)
      break
    case 'agent_performance':
      data = await getAgentPerformanceSummary(ctx.accountId!)
      break
    default:
      data = {}
  }

  return {
    widget_id: widgetId,
    data_source: widget.data_source,
    data,
    refreshed_at: new Date().toISOString()
  }
}

async function getTypeRegistrySummary(accountId: string) {
  const { data } = await db
    .from('admin_type_registry_summary')
    .select('*')
    .order('slug', { ascending: true })

  return data || []
}

async function getPackLifecycleSummary(accountId: string) {
  const { data } = await db
    .from('admin_pack_lifecycle_summary')
    .select('*')
    .order('installed_at', { ascending: false })

  return data || []
}

async function getAgentPerformanceSummary(accountId: string) {
  const { data } = await db
    .from('admin_agent_performance_summary')
    .select('*')
    .order('created_at', { ascending: false })

  return data || []
}
