import { schedule } from '@netlify/functions'
import { db } from './_shared/db'
import { executeAction, evaluateConditions } from './_shared/action-executor'
import { nextCronDate } from './_shared/cron'
import { logError } from './_shared/errors'

async function handler() {
  const now = new Date().toISOString()
  const runId = crypto.randomUUID()
  let executed = 0
  let errors = 0

  try {
    // 1. One-time triggers that are due
    const { data: oneTimeTriggers } = await db
      .from('scheduled_triggers')
      .select('*')
      .eq('trigger_type', 'one_time')
      .eq('enabled', true)
      .eq('fire_count', 0)
      .lte('fire_at', now)
      .limit(50)

    for (const trigger of oneTimeTriggers || []) {
      try {
        if (!evaluateConditions(trigger.conditions, {})) continue

        const result = await executeAction(
          { id: trigger.id, name: trigger.name, action_type: trigger.action_type, action_config: trigger.action_config },
          trigger.account_id,
          { trigger_id: trigger.id, trigger_name: trigger.name, trigger_type: 'one_time' },
        )

        await db.from('scheduled_triggers').update({
          fire_count: trigger.fire_count + 1,
          last_fired_at: now,
          enabled: false, // one-time: disable after firing
          updated_at: now,
        }).eq('id', trigger.id)

        await db.from('activity_events').insert({
          account_id: trigger.account_id,
          person_id: null,
          event_type: 'scheduled_trigger.fired',
          entity_type: 'scheduled_trigger',
          entity_id: trigger.id,
          summary: `Scheduled trigger "${trigger.name}" fired`,
          metadata: { trigger_type: 'one_time', result },
        })

        executed++
        console.log(`[scheduler] one_time "${trigger.name}" fired: ${result.success}`)
      } catch (err: any) {
        errors++
        console.error(`[scheduler] one_time "${trigger.name}" failed:`, err.message)
        await logError({ requestId: runId, functionName: 'trigger-scheduler', errorCode: 'internal', message: `one_time "${trigger.name}": ${err.message}`, stack: err.stack, accountId: trigger.account_id })
      }
    }

    // 2. Recurring triggers that are due
    const { data: recurringTriggers } = await db
      .from('scheduled_triggers')
      .select('*')
      .eq('trigger_type', 'recurring')
      .eq('enabled', true)
      .not('next_fire_at', 'is', null)
      .lte('next_fire_at', now)
      .limit(50)

    for (const trigger of recurringTriggers || []) {
      try {
        if (!evaluateConditions(trigger.conditions, {})) continue

        const result = await executeAction(
          { id: trigger.id, name: trigger.name, action_type: trigger.action_type, action_config: trigger.action_config },
          trigger.account_id,
          { trigger_id: trigger.id, trigger_name: trigger.name, trigger_type: 'recurring', fire_count: trigger.fire_count },
        )

        // Advance next_fire_at
        let nextFire: string | null = null
        try {
          nextFire = nextCronDate(trigger.cron_expression, new Date()).toISOString()
        } catch (e: any) {
          console.error(`[scheduler] Failed to compute next cron date for "${trigger.name}":`, e.message)
        }

        await db.from('scheduled_triggers').update({
          fire_count: trigger.fire_count + 1,
          last_fired_at: now,
          next_fire_at: nextFire,
          updated_at: now,
        }).eq('id', trigger.id)

        await db.from('activity_events').insert({
          account_id: trigger.account_id,
          person_id: null,
          event_type: 'scheduled_trigger.fired',
          entity_type: 'scheduled_trigger',
          entity_id: trigger.id,
          summary: `Recurring trigger "${trigger.name}" fired (run #${trigger.fire_count + 1})`,
          metadata: { trigger_type: 'recurring', result, next_fire_at: nextFire },
        })

        executed++
        console.log(`[scheduler] recurring "${trigger.name}" fired, next: ${nextFire}`)
      } catch (err: any) {
        errors++
        console.error(`[scheduler] recurring "${trigger.name}" failed:`, err.message)
        await logError({ requestId: runId, functionName: 'trigger-scheduler', errorCode: 'internal', message: `recurring "${trigger.name}": ${err.message}`, stack: err.stack, accountId: trigger.account_id })
      }
    }

    // 3. Pending instances (countdown + workflow builder timers)
    const { data: pendingInstances } = await db
      .from('scheduled_trigger_instances')
      .select('*, trigger:trigger_id(id, name, action_type, action_config, conditions)')
      .eq('status', 'pending')
      .lte('fire_at', now)
      .limit(100)

    for (const instance of pendingInstances || []) {
      try {
        // Determine action from parent trigger or ad-hoc instance
        const actionType = instance.trigger?.action_type || instance.action_type
        const actionConfig = instance.trigger?.action_config || instance.action_config || {}
        const actionName = instance.trigger?.name || 'Scheduled Timer'
        const conditions = instance.trigger?.conditions || []

        if (!actionType) {
          await db.from('scheduled_trigger_instances').update({ status: 'failed', fired_at: now, result: { error: 'No action_type' } }).eq('id', instance.id)
          continue
        }

        if (!evaluateConditions(conditions, instance.context || {})) {
          await db.from('scheduled_trigger_instances').update({ status: 'cancelled', fired_at: now, result: { skipped: 'conditions_not_met' } }).eq('id', instance.id)
          continue
        }

        const result = await executeAction(
          { id: instance.trigger_id || instance.id, name: actionName, action_type: actionType, action_config: actionConfig },
          instance.account_id,
          { ...(instance.context || {}), trigger_instance_id: instance.id },
        )

        await db.from('scheduled_trigger_instances').update({
          status: result.success ? 'fired' : 'failed',
          fired_at: now,
          result,
        }).eq('id', instance.id)

        // Update parent trigger stats if exists
        if (instance.trigger_id) {
          const { data: parent } = await db.from('scheduled_triggers').select('fire_count').eq('id', instance.trigger_id).single()
          if (parent) {
            await db.from('scheduled_triggers').update({
              fire_count: parent.fire_count + 1,
              last_fired_at: now,
              updated_at: now,
            }).eq('id', instance.trigger_id)
          }
        }

        await db.from('activity_events').insert({
          account_id: instance.account_id,
          person_id: null,
          event_type: 'scheduled_trigger.instance_fired',
          entity_type: 'scheduled_trigger_instance',
          entity_id: instance.id,
          summary: `Timer "${actionName}" fired`,
          metadata: { trigger_id: instance.trigger_id, result },
        })

        executed++
        console.log(`[scheduler] instance ${instance.id} fired: ${result.success}`)
      } catch (err: any) {
        errors++
        try {
          await db.from('scheduled_trigger_instances').update({
            status: 'failed',
            fired_at: now,
            result: { error: err.message },
          }).eq('id', instance.id)
        } catch (_) { /* ignore */ }
        console.error(`[scheduler] instance ${instance.id} failed:`, err.message)
        await logError({ requestId: runId, functionName: 'trigger-scheduler', errorCode: 'internal', message: `instance ${instance.id}: ${err.message}`, stack: err.stack, accountId: instance.account_id })
      }
    }
  } catch (err: any) {
    console.error('[scheduler] Top-level error:', err.message)
    await logError({ requestId: runId, functionName: 'trigger-scheduler', errorCode: 'internal', message: err.message, stack: err.stack })
  }

  console.log(`[${runId}] [scheduler] Done. Executed: ${executed}, Errors: ${errors}`)
  return { statusCode: 200 }
}

// Run every minute
export const handler_scheduled = schedule('* * * * *', handler)

// Also export as default for manual invocation / testing
export default handler
