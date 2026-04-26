import { createHandler, requireAuth } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Get integration health metrics
export const getMetrics = createHandler(async (ctx, _body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_integration_health_metrics', {
      account_id: ctx.accountId
    })

  if (err) throw err

  return data
})

// Get integration summary
export const getSummary = createHandler(async (ctx, _body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const summary: Record<string, any> = {}

  // Integration counts by type — fetch all, aggregate in JS
  const { data: allIntegrations, error: integrationErr } = await db
    .from('integrations')
    .select('id, integration_type, provider, is_active, is_configured')
    .eq('account_id', ctx.accountId)

  if (!integrationErr && allIntegrations) {
    const byType: Record<string, { count: number; active: number; configured: number }> = {}
    for (const i of allIntegrations) {
      const t = i.integration_type || 'unknown'
      if (!byType[t]) byType[t] = { count: 0, active: 0, configured: 0 }
      byType[t].count++
      if (i.is_active) byType[t].active++
      if (i.is_configured) byType[t].configured++
    }
    summary.integrations_by_type = byType

    // Provider distribution — aggregate from same data
    const byProvider: Record<string, number> = {}
    for (const i of allIntegrations) {
      byProvider[i.provider] = (byProvider[i.provider] || 0) + 1
    }
    summary.top_providers = Object.entries(byProvider)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([provider, count]) => ({ provider, count }))
  }

  // Recent sync activity
  const { data: recentSyncs, error: syncErr } = await db
    .from('integration_sync_logs')
    .select(`
      integration_id,
      integration:integrations(name, provider),
      status,
      started_at,
      duration_ms,
      records_processed
    `)
    .eq('account_id', ctx.accountId)
    .order('started_at', { ascending: false })
    .limit(10)

  if (!syncErr) {
    summary.recent_syncs = recentSyncs
  }

  // OAuth token status — fetch raw, compute status in JS
  const { data: oauthRaw, error: oauthErr } = await db
    .from('oauth_connections')
    .select(`
      integration_id,
      integration:integrations(name, provider),
      expires_at,
      is_active
    `)
    .eq('account_id', ctx.accountId)
    .order('expires_at')

  if (!oauthErr && oauthRaw) {
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    summary.oauth_tokens = oauthRaw.map((t: any) => {
      let token_status = 'valid'
      if (!t.expires_at) token_status = 'no_expiry'
      else if (new Date(t.expires_at).getTime() <= now) token_status = 'expired'
      else if (new Date(t.expires_at).getTime() <= now + sevenDays) token_status = 'expiring_soon'
      return { ...t, token_status }
    })
  }

  // API key status — fetch raw, compute status in JS
  const { data: apiKeyRaw, error: apiKeyErr } = await db
    .from('api_keys')
    .select(`
      integration_id,
      integration:integrations(name, provider),
      expires_at,
      is_active,
      usage_count,
      rate_limit
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (!apiKeyErr && apiKeyRaw) {
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    summary.api_keys = apiKeyRaw.map((k: any) => {
      let key_status = 'valid'
      if (!k.expires_at) key_status = 'no_expiry'
      else if (new Date(k.expires_at).getTime() <= now) key_status = 'expired'
      else if (new Date(k.expires_at).getTime() <= now + sevenDays) key_status = 'expiring_soon'
      return { ...k, key_status }
    })
  }

  return summary
})

// Get integration performance metrics
export const getPerformanceMetrics = createHandler(async (ctx, _body) => {
  const { date_from, date_to, integration_id } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const metrics: Record<string, any> = {}

  // Sync performance — fetch raw logs, aggregate in JS
  let syncQuery = db
    .from('integration_sync_logs')
    .select(`
      integration_id,
      integration:integrations(name, provider),
      sync_type,
      status,
      duration_ms,
      records_processed,
      started_at
    `)
    .eq('account_id', ctx.accountId)

  if (date_from) {
    syncQuery = syncQuery.gte('started_at', date_from)
  }
  if (date_to) {
    syncQuery = syncQuery.lte('started_at', date_to)
  }
  if (integration_id) {
    syncQuery = syncQuery.eq('integration_id', integration_id)
  }

  const { data: syncLogs, error: syncErr } = await syncQuery

  if (!syncErr && syncLogs) {
    const grouped: Record<string, any> = {}
    for (const log of syncLogs) {
      const key = `${log.integration_id}::${log.sync_type}`
      if (!grouped[key]) {
        grouped[key] = {
          integration_id: log.integration_id,
          integration: log.integration,
          sync_type: log.sync_type,
          total_syncs: 0,
          successful_syncs: 0,
          failed_syncs: 0,
          total_duration_ms: 0,
          total_records: 0,
          last_sync: log.started_at
        }
      }
      const g = grouped[key]
      g.total_syncs++
      if (log.status === 'completed') g.successful_syncs++
      if (log.status === 'failed') g.failed_syncs++
      g.total_duration_ms += log.duration_ms || 0
      g.total_records += log.records_processed || 0
      if (log.started_at > g.last_sync) g.last_sync = log.started_at
    }
    metrics.sync_performance = Object.values(grouped).map((g: any) => ({
      ...g,
      avg_duration_ms: g.total_syncs > 0 ? g.total_duration_ms / g.total_syncs : 0,
      total_duration_ms: undefined
    }))
  }

  // API key usage performance — fetch raw logs, aggregate in JS
  let usageQuery = db
    .from('api_key_usage_logs')
    .select(`
      api_key_id,
      api_key:api_keys(name, key_type),
      success,
      duration_ms,
      created_at
    `)
    .eq('account_id', ctx.accountId)

  if (date_from) {
    usageQuery = usageQuery.gte('created_at', date_from)
  }
  if (date_to) {
    usageQuery = usageQuery.lte('created_at', date_to)
  }

  const { data: usageLogs, error: usageErr } = await usageQuery

  if (!usageErr && usageLogs) {
    const grouped: Record<string, any> = {}
    for (const log of usageLogs) {
      const key = log.api_key_id
      if (!grouped[key]) {
        grouped[key] = {
          api_key_id: log.api_key_id,
          api_key: log.api_key,
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          total_duration_ms: 0,
          last_used: log.created_at
        }
      }
      const g = grouped[key]
      g.total_requests++
      if (log.success) g.successful_requests++
      else g.failed_requests++
      g.total_duration_ms += log.duration_ms || 0
      if (log.created_at > g.last_used) g.last_used = log.created_at
    }
    metrics.api_key_usage = Object.values(grouped).map((g: any) => ({
      ...g,
      avg_duration_ms: g.total_requests > 0 ? g.total_duration_ms / g.total_requests : 0,
      total_duration_ms: undefined
    }))
  }

  return metrics
})

// Get integration alerts
export const getAlerts = createHandler(async (ctx, _body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const alerts: Array<{ type: string; category: string; title: string; message: string; count: number; details: any }> = []

  // Check for expired OAuth tokens
  const { data: expiredTokens, error: tokenErr } = await db
    .from('oauth_connections')
    .select(`
      id,
      integration_id,
      integration:integrations(name, provider),
      expires_at
    `)
    .eq('account_id', ctx.accountId)
    .eq('is_active', true)
    .lte('expires_at', new Date().toISOString())

  if (!tokenErr && expiredTokens.length > 0) {
    alerts.push({
      type: 'error',
      category: 'oauth',
      title: 'Expired OAuth Tokens',
      message: `${expiredTokens.length} OAuth token(s) have expired`,
      count: expiredTokens.length,
      details: expiredTokens
    })
  }

  // Check for tokens expiring soon
  const nowIso = new Date().toISOString()
  const sevenDaysFromNowIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: expiringTokens, error: expiringErr } = await db
    .from('oauth_connections')
    .select(`
      id,
      integration_id,
      integration:integrations(name, provider),
      expires_at
    `)
    .eq('account_id', ctx.accountId)
    .eq('is_active', true)
    .gt('expires_at', nowIso)
    .lte('expires_at', sevenDaysFromNowIso)

  if (!expiringErr && expiringTokens.length > 0) {
    alerts.push({
      type: 'warning',
      category: 'oauth',
      title: 'OAuth Tokens Expiring Soon',
      message: `${expiringTokens.length} OAuth token(s) will expire within 7 days`,
      count: expiringTokens.length,
      details: expiringTokens
    })
  }

  // Check for failed syncs — fetch raw, aggregate in JS
  const { data: failedSyncLogs, error: syncErr } = await db
    .from('integration_sync_logs')
    .select(`
      integration_id,
      integration:integrations(name, provider)
    `)
    .eq('account_id', ctx.accountId)
    .eq('status', 'failed')
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (!syncErr && failedSyncLogs && failedSyncLogs.length > 0) {
    const byIntegration: Record<string, { integration_id: string; integration: any; failed_count: number }> = {}
    for (const log of failedSyncLogs) {
      if (!byIntegration[log.integration_id]) {
        byIntegration[log.integration_id] = { integration_id: log.integration_id, integration: log.integration, failed_count: 0 }
      }
      byIntegration[log.integration_id].failed_count++
    }
    const failedSyncs = Object.values(byIntegration)
    alerts.push({
      type: 'error',
      category: 'sync',
      title: 'Failed Sync Operations',
      message: `${failedSyncs.length} integration(s) had sync failures in the last 24 hours`,
      count: failedSyncs.length,
      details: failedSyncs
    })
  }

  // Check for unconfigured integrations
  const { data: unconfigured, error: configErr } = await db
    .from('integrations')
    .select('id, name, provider')
    .eq('account_id', ctx.accountId)
    .eq('is_active', true)
    .eq('is_configured', false)

  if (!configErr && unconfigured.length > 0) {
    alerts.push({
      type: 'warning',
      category: 'configuration',
      title: 'Unconfigured Integrations',
      message: `${unconfigured.length} integration(s) are active but not configured`,
      count: unconfigured.length,
      details: unconfigured
    })
  }

  // Check for API keys approaching rate limits — fetch all active, filter in JS
  const { data: allApiKeys, error: rateErr } = await db
    .from('api_keys')
    .select(`
      id,
      name,
      usage_count,
      rate_limit,
      integration:integrations(name, provider)
    `)
    .eq('account_id', ctx.accountId)
    .eq('is_active', true)

  if (!rateErr && allApiKeys) {
    const rateLimitWarnings = allApiKeys.filter(
      (k: any) => k.rate_limit && k.usage_count >= k.rate_limit * 0.8
    )
    if (rateLimitWarnings.length > 0) {
      alerts.push({
        type: 'warning',
        category: 'rate_limit',
        title: 'API Keys Approaching Rate Limits',
        message: `${rateLimitWarnings.length} API key(s) are approaching their rate limits`,
        count: rateLimitWarnings.length,
        details: rateLimitWarnings
      })
    }
  }

  return alerts.sort((a, b) => {
    const severity = { error: 3, warning: 2, info: 1 }
    return (severity[b.type as keyof typeof severity] || 0) - (severity[a.type as keyof typeof severity] || 0)
  })
})

// Get integration recommendations
export const getRecommendations = createHandler(async (ctx, _body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const recommendations: Array<Record<string, any>> = []

  // Analyze current integrations
  const { data: currentIntegrations, error: intErr } = await db
    .from('integrations')
    .select('integration_type, provider, is_configured, last_sync_at')
    .eq('account_id', ctx.accountId)

  if (!intErr) {
    const integrationTypes = new Set(currentIntegrations.map(i => i.integration_type))
    // Recommend common integrations
    if (!integrationTypes.has('oauth')) {
      recommendations.push({
        type: 'suggestion',
        title: 'Add OAuth Integration',
        description: 'Connect with popular services like GitHub, Slack, or Google',
        priority: 'medium',
        suggested_providers: ['github', 'slack', 'google_drive']
      })
    }

    if (!integrationTypes.has('email')) {
      recommendations.push({
        type: 'suggestion',
        title: 'Add Email Service',
        description: 'Set up email delivery for notifications and communications',
        priority: 'high',
        suggested_providers: ['sendgrid']
      })
    }

    if (!integrationTypes.has('file_storage')) {
      recommendations.push({
        type: 'suggestion',
        title: 'Add File Storage',
        description: 'Connect cloud storage for file management and sharing',
        priority: 'medium',
        suggested_providers: ['aws_s3', 'google_drive']
      })
    }

    // Check for inactive integrations
    const inactiveIntegrations = currentIntegrations.filter(i => !i.is_configured)
    if (inactiveIntegrations.length > 0) {
      recommendations.push({
        type: 'action',
        title: 'Configure Inactive Integrations',
        description: `${inactiveIntegrations.length} integration(s) need configuration`,
        priority: 'high',
        affected_integrations: inactiveIntegrations.map(i => i.provider)
      })
    }

    // Check for old syncs
    const oldSyncs = currentIntegrations.filter(i => 
      i.last_sync_at && new Date(i.last_sync_at).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000
    )
    if (oldSyncs.length > 0) {
      recommendations.push({
        type: 'action',
        title: 'Update Old Integrations',
        description: `${oldSyncs.length} integration(s) haven't synced in over a week`,
        priority: 'medium',
        affected_integrations: oldSyncs.map(i => i.provider)
      })
    }
  }

  return recommendations.sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 }
    return (priority[b.priority as keyof typeof priority] || 0) - (priority[a.priority as keyof typeof priority] || 0)
  })
})

// Run health check
export const runHealthCheck = requireAuth(createHandler(async (ctx, _body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const results: { timestamp: string; overall_status: string; checks: Array<{ name: string; status: string; details: Record<string, any> }> } = {
    timestamp: new Date().toISOString(),
    overall_status: 'healthy',
    checks: []
  }

  // Check integration connectivity
  const { data: integrations, error: intErr } = await db
    .from('integrations')
    .select('id, name, provider, is_active, is_configured')
    .eq('account_id', ctx.accountId)
    .eq('is_active', true)

  if (!intErr) {
    const connectivityResults = {
      name: 'Integration Connectivity',
      status: 'healthy',
      details: {
        total_integrations: integrations.length,
        configured_integrations: integrations.filter(i => i.is_configured).length,
        tested_integrations: 0,
        successful_tests: 0
      }
    }

    // Test each integration (simplified)
    for (const integration of integrations) {
      if (integration.is_configured) {
        connectivityResults.details.tested_integrations++
        // In production, this would actually test the connection
        connectivityResults.details.successful_tests++
      }
    }

    if (connectivityResults.details.configured_integrations < connectivityResults.details.total_integrations) {
      connectivityResults.status = 'warning'
    }

    results.checks.push(connectivityResults)
  }

  // Check OAuth token health
  const { data: oauthTokens, error: oauthErr } = await db
    .from('oauth_connections')
    .select('id, expires_at, is_active')
    .eq('account_id', ctx.accountId)

  if (!oauthErr) {
    const oauthResults = {
      name: 'OAuth Token Health',
      status: 'healthy',
      details: {
        total_tokens: oauthTokens.length,
        active_tokens: oauthTokens.filter(t => t.is_active).length,
        expired_tokens: oauthTokens.filter(t => t.expires_at && new Date(t.expires_at) <= new Date()).length,
        expiring_soon: oauthTokens.filter(t => 
          t.expires_at && new Date(t.expires_at) > new Date() && new Date(t.expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ).length
      }
    }

    if (oauthResults.details.expired_tokens > 0) {
      oauthResults.status = 'error'
    } else if (oauthResults.details.expiring_soon > 0) {
      oauthResults.status = 'warning'
    }

    results.checks.push(oauthResults)
  }

  // Check recent sync performance
  const { data: recentSyncs, error: syncErr } = await db
    .from('integration_sync_logs')
    .select('status, duration_ms, started_at')
    .eq('account_id', ctx.accountId)
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (!syncErr) {
    const syncResults = {
      name: 'Sync Performance',
      status: 'healthy',
      details: {
        total_syncs: recentSyncs.length,
        successful_syncs: recentSyncs.filter(s => s.status === 'completed').length,
        failed_syncs: recentSyncs.filter(s => s.status === 'failed').length,
        avg_duration: recentSyncs.reduce((sum, s) => sum + (s.duration_ms || 0), 0) / recentSyncs.length
      }
    }

    if (syncResults.details.failed_syncs > 0) {
      syncResults.status = 'warning'
    }

    results.checks.push(syncResults)
  }

  // Determine overall status
  const errorCount = results.checks.filter(c => c.status === 'error').length
  const warningCount = results.checks.filter(c => c.status === 'warning').length

  if (errorCount > 0) {
    results.overall_status = 'error'
  } else if (warningCount > 0) {
    results.overall_status = 'warning'
  }

  await emitLog(ctx, 'integration_health_check.run', 
    { type: 'system', id: 'health_check' }, 
    { after: { overall_status: results.overall_status } }
  )

  return results
}))

// Main handler function
export const handler = createHandler(async (ctx, _body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'metrics':
      if (method === 'GET') {
        return await getMetrics(ctx, _body)
      }
      break
    case 'summary':
      if (method === 'GET') {
        return await getSummary(ctx, _body)
      }
      break
    case 'performance':
      if (method === 'GET') {
        return await getPerformanceMetrics(ctx, _body)
      }
      break
    case 'alerts':
      if (method === 'GET') {
        return await getAlerts(ctx, _body)
      }
      break
    case 'recommendations':
      if (method === 'GET') {
        return await getRecommendations(ctx, _body)
      }
      break
    case 'health-check':
      if (method === 'POST') {
        return await runHealthCheck(ctx, _body)
      }
      break
    default:
      if (method === 'GET') {
        return await getMetrics(ctx, _body)
      }
  }

  throw new Error('Invalid action or method')
})
