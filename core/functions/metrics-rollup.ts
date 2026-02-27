import { db } from './_shared/db'
import { logError } from './_shared/errors'

export const config = {
  schedule: '0 * * * *', // every hour at :00
}

const PRUNE_DAYS = 14

export default async function handler() {
  const runId = crypto.randomUUID()
  const now = new Date()

  // Compute the previous full hour window
  const periodEnd = new Date(now)
  periodEnd.setMinutes(0, 0, 0)
  const periodStart = new Date(periodEnd.getTime() - 60 * 60 * 1000)

  const periodStartISO = periodStart.toISOString()
  const periodEndISO = periodEnd.toISOString()

  console.log(`[${runId}] [metrics-rollup] Rolling up ${periodStartISO} → ${periodEndISO}`)

  try {
    // 1. Error counts by function_name and error_code
    const { data: errorRows } = await db
      .from('error_events')
      .select('function_name, error_code')
      .gte('created_at', periodStartISO)
      .lt('created_at', periodEndISO)

    const byFunction: Record<string, { total: number; codes: Record<string, number> }> = {}

    for (const row of errorRows || []) {
      const fn = row.function_name || '_unknown'
      if (!byFunction[fn]) byFunction[fn] = { total: 0, codes: {} }
      byFunction[fn].total++
      byFunction[fn].codes[row.error_code] = (byFunction[fn].codes[row.error_code] || 0) + 1
    }

    // 2. Scheduler stats from activity_events
    const { data: schedulerEvents } = await db
      .from('activity_events')
      .select('event_type')
      .in('event_type', ['scheduled_trigger.fired', 'scheduled_trigger.instance_fired'])
      .gte('created_at', periodStartISO)
      .lt('created_at', periodEndISO)

    let schedulerExecuted = 0
    for (const e of schedulerEvents || []) {
      schedulerExecuted++
    }

    // Scheduler errors = error_events from trigger-scheduler in this period
    const schedulerErrors = byFunction['trigger-scheduler']?.total || 0

    // 3. Webhook delivery stats
    const { data: webhookSuccess } = await db
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('completed_at', periodStartISO)
      .lt('completed_at', periodEndISO)

    const { data: webhookFailed } = await db
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'dead_letter'])
      .gte('updated_at', periodStartISO)
      .lt('updated_at', periodEndISO)

    const webhookDelivered = (webhookSuccess as any)?.length ?? 0
    const webhookFailedCount = (webhookFailed as any)?.length ?? 0

    // 4. Insert per-function snapshots
    const snapshots = Object.entries(byFunction).map(([fn, data]) => ({
      period_start: periodStartISO,
      period_end: periodEndISO,
      function_name: fn,
      total_errors: data.total,
      error_codes: data.codes,
      scheduler_executed: 0,
      scheduler_errors: 0,
      webhook_delivered: 0,
      webhook_failed: 0,
    }))

    // System-wide summary row
    const totalErrors = Object.values(byFunction).reduce((sum, d) => sum + d.total, 0)
    const allCodes: Record<string, number> = {}
    for (const d of Object.values(byFunction)) {
      for (const [code, count] of Object.entries(d.codes)) {
        allCodes[code] = (allCodes[code] || 0) + count
      }
    }

    snapshots.push({
      period_start: periodStartISO,
      period_end: periodEndISO,
      function_name: '_system',
      total_errors: totalErrors,
      error_codes: allCodes,
      scheduler_executed: schedulerExecuted,
      scheduler_errors: schedulerErrors,
      webhook_delivered: webhookDelivered,
      webhook_failed: webhookFailedCount,
    })

    if (snapshots.length > 0) {
      const { error: insertErr } = await db.from('metrics_snapshots').insert(snapshots)
      if (insertErr) {
        console.error(`[${runId}] [metrics-rollup] Insert failed:`, insertErr.message)
      }
    }

    // 5. Prune old error_events
    const pruneDate = new Date(now.getTime() - PRUNE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error: pruneErr } = await db
      .from('error_events')
      .delete()
      .lt('created_at', pruneDate)

    if (pruneErr) {
      console.error(`[${runId}] [metrics-rollup] Prune failed:`, pruneErr.message)
    }

    console.log(`[${runId}] [metrics-rollup] Done. ${snapshots.length} snapshots, ${totalErrors} errors, pruned < ${pruneDate}`)
  } catch (err: any) {
    console.error(`[${runId}] [metrics-rollup] Fatal:`, err.message)
    await logError({
      requestId: runId,
      functionName: 'metrics-rollup',
      errorCode: 'internal',
      message: err.message,
      stack: err.stack,
    })
  }

  return new Response(JSON.stringify({ ok: true }))
}
