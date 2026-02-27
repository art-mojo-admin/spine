import { db } from './db'
import type { RequestContext } from './middleware'
import { validateOutboundUrl, validateEntityTable, validateFieldName } from './security'

interface AutomationRule {
  id: string
  account_id: string
  workflow_definition_id: string | null
  name: string
  trigger_event: string
  conditions: any[]
  action_type: string
  action_config: Record<string, any>
  enabled: boolean
}

function evaluateConditions(conditions: any[], payload: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((cond: any) => {
    const value = getNestedValue(payload, cond.field)
    switch (cond.operator) {
      case 'equals': return value === cond.value
      case 'not_equals': return value !== cond.value
      case 'contains': return typeof value === 'string' && value.includes(cond.value)
      case 'in': return Array.isArray(cond.value) && cond.value.includes(value)
      case 'exists': return value !== undefined && value !== null
      case 'gt': return typeof value === 'number' && value > cond.value
      case 'lt': return typeof value === 'number' && value < cond.value
      default: return true
    }
  })
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

async function executeAction(
  rule: AutomationRule,
  ctx: RequestContext,
  payload: Record<string, any>,
): Promise<void> {
  const config = rule.action_config

  switch (rule.action_type) {
    case 'transition_stage': {
      const entityId = payload.entity_id || payload.id || payload.after?.id
      if (!entityId || !config.target_stage_id) break

      await db
        .from('items')
        .update({ stage_definition_id: config.target_stage_id })
        .eq('id', entityId)
        .eq('account_id', rule.account_id)

      console.log(`[automation] ${rule.name}: transitioned ${entityId} to stage ${config.target_stage_id}`)
      break
    }

    case 'emit_event': {
      if (!config.event_type) break

      await db.from('outbox_events').insert({
        account_id: rule.account_id,
        event_type: config.event_type,
        entity_type: config.entity_type || payload.entity_type || null,
        entity_id: config.entity_id || payload.entity_id || null,
        payload: { ...payload, triggered_by_automation: rule.id },
      })

      console.log(`[automation] ${rule.name}: emitted event ${config.event_type}`)
      break
    }

    case 'webhook': {
      if (!config.url) break

      try {
        const safeUrl = validateOutboundUrl(config.url)
        await fetch(safeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            automation_rule_id: rule.id,
            trigger_event: rule.trigger_event,
            payload,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(5000),
        })
        console.log(`[automation] ${rule.name}: sent webhook to ${safeUrl}`)
      } catch (err: any) {
        console.error(`[automation] ${rule.name}: webhook failed: ${err.message}`)
      }
      break
    }

    case 'update_field': {
      const entityId = payload.entity_id || payload.id || payload.after?.id
      if (!entityId || !config.entity_table || !config.field || config.value === undefined) break

      const table = validateEntityTable(config.entity_table)
      const field = validateFieldName(config.field)
      await db
        .from(table)
        .update({ [field]: config.value })
        .eq('id', entityId)
        .eq('account_id', rule.account_id)

      console.log(`[automation] ${rule.name}: updated ${table}.${field} on ${entityId}`)
      break
    }

    default: {
      // Look up custom action types registered for this account
      const { data: customType } = await db
        .from('custom_action_types')
        .select('handler_url, name')
        .eq('account_id', rule.account_id)
        .eq('slug', rule.action_type)
        .single()

      if (!customType) {
        console.warn(`[automation] Unknown action type: ${rule.action_type}`)
        break
      }

      try {
        const safeHandlerUrl = validateOutboundUrl(customType.handler_url)
        const res = await fetch(safeHandlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_name: rule.name,
            action_type: rule.action_type,
            action_config: config,
            account_id: rule.account_id,
            payload,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(15000),
        })
        console.log(`[automation] ${rule.name}: custom action "${customType.name}" → ${res.status}`)
      } catch (err: any) {
        console.error(`[automation] ${rule.name}: custom action failed: ${err.message}`)
      }
      break
    }
  }
}

export async function evaluateAutomations(
  accountId: string,
  eventType: string,
  ctx: RequestContext,
  payload: Record<string, any>,
): Promise<void> {
  try {
    const { data: rules } = await db
      .from('automation_rules')
      .select('*')
      .eq('account_id', accountId)
      .eq('trigger_event', eventType)
      .eq('enabled', true)

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        try {
          if (evaluateConditions(rule.conditions, payload)) {
            await executeAction(rule, ctx, payload)

            await db.from('activity_events').insert({
              account_id: accountId,
              person_id: null,
              event_type: 'automation.executed',
              entity_type: 'automation_rule',
              entity_id: rule.id,
              summary: `Automation "${rule.name}" triggered by ${eventType}`,
              metadata: { trigger_event: eventType, action_type: rule.action_type },
            })
          }
        } catch (err: any) {
          console.error(`[automation] Rule ${rule.id} (${rule.name}) failed:`, err.message)
        }
      }
    }

    // Evaluate countdown triggers matching this event
    await evaluateCountdownTriggers(accountId, eventType, payload)
  } catch (err: any) {
    console.error('[automation] Evaluation failed:', err.message)
  }
}

async function evaluateCountdownTriggers(
  accountId: string,
  eventType: string,
  payload: Record<string, any>,
): Promise<void> {
  try {
    const { data: triggers } = await db
      .from('scheduled_triggers')
      .select('*')
      .eq('account_id', accountId)
      .eq('trigger_type', 'countdown')
      .eq('delay_event', eventType)
      .eq('enabled', true)

    if (!triggers || triggers.length === 0) return

    for (const trigger of triggers) {
      try {
        if (!evaluateConditions(trigger.conditions, payload)) continue

        const fireAt = new Date(Date.now() + (trigger.delay_seconds || 0) * 1000)

        await db.from('scheduled_trigger_instances').insert({
          trigger_id: trigger.id,
          account_id: accountId,
          fire_at: fireAt.toISOString(),
          status: 'pending',
          context: payload,
        })

        console.log(`[automation] Countdown "${trigger.name}" instance created, fires at ${fireAt.toISOString()}`)
      } catch (err: any) {
        console.error(`[automation] Countdown trigger ${trigger.id} (${trigger.name}) failed:`, err.message)
      }
    }
  } catch (err: any) {
    console.error('[automation] Countdown evaluation failed:', err.message)
  }
}
