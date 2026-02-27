import { createHandler, json, error, requireAuth } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx) {
    const authErr = requireAuth(ctx)
    if (authErr) return authErr

    // System admins only
    if (!ctx.systemRole || !['system_admin', 'system_operator'].includes(ctx.systemRole)) {
      return error('Forbidden', 403)
    }

    const url = new URL(req.url)
    const hours = parseInt(url.searchParams.get('hours') || '24', 10)
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Recent errors
    const { data: recentErrors } = await db
      .from('error_events')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50)

    // Metrics snapshots for the period
    const { data: snapshots } = await db
      .from('metrics_snapshots')
      .select('*')
      .gte('period_start', since)
      .order('period_start', { ascending: true })

    // Current pending counts
    const { count: pendingTriggers } = await db
      .from('scheduled_trigger_instances')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    const { count: pendingDeliveries } = await db
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed'])

    return json({
      recentErrors: recentErrors || [],
      snapshots: snapshots || [],
      pending: {
        schedulerInstances: pendingTriggers || 0,
        webhookDeliveries: pendingDeliveries || 0,
      },
    })
  },
})
