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

    const alertId = params.get('alert_id')
    const type = params.get('type')
    const severity = params.get('severity')
    const resolved = params.get('resolved')
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')

    try {
      let query = db
        .from('admin_alerts')
        .select(`
          *,
          principals:resolved_by_principal_id (
            id,
            principal_type,
            display_name
          )
        `)
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })

      if (alertId) query = query.eq('id', alertId)
      if (type) query = query.eq('alert_type', type)
      if (severity) query = query.eq('alert_severity', severity)
      if (resolved !== undefined) query = query.eq('is_resolved', resolved === 'true')

      if (limit > 0) query = query.limit(limit)
      if (offset > 0) query = query.range(offset, offset + limit - 1)

      const { data, error } = await query

      if (error) throw error
      return json(data || [])
    } catch (err: any) {
      return error(err.message || 'Admin alerts query failed', 500)
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
      alert_type: 'system' | 'security' | 'performance' | 'pack' | 'agent' | 'audit'
      alert_severity: 'info' | 'warning' | 'error' | 'critical'
      alert_title: string
      alert_message?: string
      alert_data?: Record<string, unknown>
      source_entity_type?: string
      source_entity_id?: string
      expires_hours?: number
    }>(req)

    if (!body.alert_type) return error('alert_type required')
    if (!body.alert_severity) return error('alert_severity required')
    if (!body.alert_title) return error('alert_title required')

    try {
      const result = await createAdminAlert(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Admin alert creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const alertId = params.get('alert_id')
    if (!alertId) return error('alert_id required')

    const body = await parseBody<{
      is_resolved?: boolean
      alert_title?: string
      alert_message?: string
      alert_data?: Record<string, unknown>
    }>(req)

    try {
      const result = await updateAdminAlert(ctx, alertId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Admin alert update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const alertId = params.get('alert_id')
    if (!alertId) return error('alert_id required')

    try {
      await deleteAdminAlert(ctx, alertId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Admin alert deletion failed', 500)
    }
  },
})

async function createAdminAlert(ctx: any, body: any) {
  const { data: alert } = await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: body.alert_type,
    alert_severity: body.alert_severity,
    alert_title: body.alert_title,
    alert_message: body.alert_message || null,
    alert_data: body.alert_data || {},
    source_entity_type: body.source_entity_type || null,
    source_entity_id: body.source_entity_id || null,
    expires_hours: body.expires_hours || 24
  })

  if (!alert) throw new Error('Failed to create admin alert')

  await emitAudit(ctx, 'create', 'admin_alert', alert, null, body)
  await emitActivity(ctx, 'admin_alert.created', `Created admin alert: ${body.alert_title}`, 'admin_alert', alert)

  return {
    alert_id: alert,
    alert_type: body.alert_type,
    alert_severity: body.alert_severity,
    alert_title: body.alert_title,
    message: 'Admin alert created successfully'
  }
}

async function updateAdminAlert(ctx: any, alertId: string, updates: any) {
  const { data: before } = await db
    .from('admin_alerts')
    .select('*')
    .eq('id', alertId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Admin alert not found')

  // Handle resolution
  if (updates.is_resolved && !before.is_resolved) {
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

    if (!success) throw new Error('Failed to resolve admin alert')

    await emitAudit(ctx, 'update', 'admin_alert', alertId, before, { is_resolved: true })
    await emitActivity(ctx, 'admin_alert.resolved', `Resolved admin alert: ${before.alert_title}`, 'admin_alert', alertId)

    return { alert_id: alertId, is_resolved: true, message: 'Alert resolved successfully' }
  }

  // Update other fields
  const updateData: Record<string, unknown> = {}
  if (updates.alert_title) updateData.alert_title = updates.alert_title
  if (updates.alert_message !== undefined) updateData.alert_message = updates.alert_message
  if (updates.alert_data) updateData.alert_data = updates.alert_data

  const { data } = await db
    .from('admin_alerts')
    .update(updateData)
    .eq('id', alertId)
    .eq('account_id', ctx.accountId)
    .select(`
      *,
      principals:resolved_by_principal_id (
        id,
        principal_type,
        display_name
      )
    `)
    .single()

  if (!data) throw new Error('Failed to update admin alert')

  await emitAudit(ctx, 'update', 'admin_alert', alertId, before, data)
  await emitActivity(ctx, 'admin_alert.updated', `Updated admin alert: ${data.alert_title}`, 'admin_alert', alertId)

  return data
}

async function deleteAdminAlert(ctx: any, alertId: string) {
  const { data: before } = await db
    .from('admin_alerts')
    .select('*')
    .eq('id', alertId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Admin alert not found')

  const { error } = await db
    .from('admin_alerts')
    .delete()
    .eq('id', alertId)
    .eq('account_id', ctx.accountId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'admin_alert', alertId, before, null)
  await emitActivity(ctx, 'admin_alert.deleted', `Deleted admin alert: ${before.alert_title}`, 'admin_alert', alertId)
}

export async function generateSystemAlerts(ctx: any) {
  const alerts = []

  // Check for failed pack installations
  const { data: failedPacks } = await db
    .from('installed_packs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('install_status', 'failed')

  for (const pack of failedPacks || []) {
    await createAdminAlert(ctx, {
      alert_type: 'pack',
      alert_severity: 'error',
      alert_title: `Pack installation failed: ${pack.pack_id}`,
      alert_message: pack.error_message || 'Unknown error',
      alert_data: { pack_id: pack.pack_id, pack_version: pack.pack_version },
      source_entity_type: 'installed_pack',
      source_entity_id: pack.id
    })
    alerts.push(`Pack failure alert created for ${pack.pack_id}`)
  }

  // Check for failed agent executions
  const { data: failedExecutions } = await db
    .from('agent_executions')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('execution_status', 'failed')
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours

  const failureCount = failedExecutions?.length || 0
  if (failureCount > 5) {
    await createAdminAlert(ctx, {
      alert_type: 'agent',
      alert_severity: 'warning',
      alert_title: 'High agent execution failure rate',
      alert_message: `${failureCount} agent executions failed in the last 24 hours`,
      alert_data: { failure_count: failureCount, timeframe: '24h' }
    })
    alerts.push(`High agent failure rate alert created`)
  }

  // Check for system performance issues
  const { data: healthData } = await db.rpc('get_admin_system_health', {
    health_account_id: ctx.accountId
  })

  if (healthData) {
    const agentMetrics = healthData?.agents || {}
    const avgExecutionTime = agentMetrics.avg_execution_time || 0

    if (avgExecutionTime > 30000) { // 30 seconds
      await createAdminAlert(ctx, {
        alert_type: 'performance',
        alert_severity: 'warning',
        alert_title: 'Slow agent execution performance',
        alert_message: `Average execution time is ${Math.round(avgExecutionTime / 1000)}s`,
        alert_data: { avg_execution_time_ms: avgExecutionTime }
      })
      alerts.push('Performance alert created for slow agent execution')
    }
  }

  return {
    alerts_generated: alerts.length,
    alerts
  }
}

export async function cleanupExpiredAlerts(ctx: any) {
  const deletedCount = await db.rpc('cleanup_expired_alerts')

  await emitAudit(ctx, 'delete', 'admin_alerts', null, null, { deleted_count: deletedCount })
  await emitActivity(ctx, 'admin_alerts.cleanup', `Cleaned up ${deletedCount} expired alerts`, 'admin_alert', undefined)

  return {
    deleted_count: deletedCount,
    message: `Cleaned up ${deletedCount} expired alerts`
  }
}

export async function getAlertStatistics(ctx: any, timeframe: string = '24h') {
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
    .from('admin_alerts')
    .select(`
      alert_type,
      alert_severity,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE is_resolved = false) as unresolved_count
    `)
    .eq('account_id', ctx.accountId)
    .gte('created_at', new Date(Date.now() - Date.parse(interval)))
    
  return data || []
}
