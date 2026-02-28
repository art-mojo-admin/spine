import { createHandler, requireAuth, requireTenant, requireRole, json, error } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const accountId = ctx.accountId!

    // Item counts by type
    const { data: itemsByType } = await db
      .from('items')
      .select('item_type')
      .eq('account_id', accountId)
      .eq('is_active', true)

    const typeCounts: Record<string, number> = {}
    for (const row of itemsByType || []) {
      typeCounts[row.item_type] = (typeCounts[row.item_type] || 0) + 1
    }

    // Item counts by workflow + stage
    const { data: itemsByStage } = await db
      .from('items')
      .select('item_type, stage_definition_id, stage_definitions(name)')
      .eq('account_id', accountId)
      .eq('is_active', true)

    const stageBreakdown: Record<string, Record<string, number>> = {}
    for (const row of (itemsByStage || []) as any[]) {
      const type = row.item_type
      const stage = row.stage_definitions?.name || 'Unknown'
      if (!stageBreakdown[type]) stageBreakdown[type] = {}
      stageBreakdown[type][stage] = (stageBreakdown[type][stage] || 0) + 1
    }

    // Activity over last 7 days (by day)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentActivity } = await db
      .from('activity_events')
      .select('created_at')
      .eq('account_id', accountId)
      .gte('created_at', sevenDaysAgo)

    const activityByDay: Record<string, number> = {}
    for (const row of recentActivity || []) {
      const day = row.created_at.substring(0, 10)
      activityByDay[day] = (activityByDay[day] || 0) + 1
    }

    // Fill in missing days
    const days: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().substring(0, 10)
      days.push({ date: key, count: activityByDay[key] || 0 })
    }

    // Totals
    const { count: totalPersons } = await db
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('is_active', true)

    const { count: totalMembers } = await db
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'active')

    // Webhook delivery stats (last 7 days)
    const { data: webhookStats } = await db
      .from('webhook_deliveries')
      .select('status')
      .gte('created_at', sevenDaysAgo)

    let webhookSuccess = 0
    let webhookFailed = 0
    for (const row of webhookStats || []) {
      if (row.status === 'success') webhookSuccess++
      else if (row.status === 'failed' || row.status === 'dead_letter') webhookFailed++
    }

    return json({
      itemsByType: typeCounts,
      stageBreakdown,
      activityByDay: days,
      totals: {
        persons: totalPersons || 0,
        members: totalMembers || 0,
        items: (itemsByType || []).length,
      },
      webhooks: {
        success: webhookSuccess,
        failed: webhookFailed,
      },
    })
  },
})
