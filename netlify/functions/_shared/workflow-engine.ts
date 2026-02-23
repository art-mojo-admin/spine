import { db } from './db'
import type { RequestContext } from './middleware'
import {
  evaluateConditions,
  interpolateTemplate,
  getNestedValue,
  executeAction as executeSharedAction,
} from './action-executor'
import { validateOutboundUrl, validateEntityTable, validateFieldName } from './security'

interface WorkflowAction {
  id: string
  workflow_definition_id: string
  name: string
  trigger_type: string
  trigger_ref_id: string | null
  action_type: string
  action_config: Record<string, any>
  conditions: any[]
  position: number
  enabled: boolean
}

async function executeWorkflowAction(
  action: WorkflowAction,
  accountId: string,
  ctx: RequestContext,
  payload: Record<string, any>,
): Promise<void> {
  const config = action.action_config

  switch (action.action_type) {
    case 'webhook': {
      if (!config.url) break
      const url = interpolateTemplate(config.url, payload)
      const body = config.body_template
        ? interpolateTemplate(JSON.stringify(config.body_template), payload)
        : JSON.stringify({
            workflow_action_id: action.id,
            workflow_action_name: action.name,
            trigger_type: action.trigger_type,
            payload,
            timestamp: new Date().toISOString(),
          })

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.headers) {
        for (const [k, v] of Object.entries(config.headers)) {
          headers[k] = interpolateTemplate(String(v), payload)
        }
      }

      try {
        const safeUrl = validateOutboundUrl(url)
        await fetch(safeUrl, {
          method: config.method || 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10000),
        })
        console.log(`[workflow-engine] ${action.name}: webhook sent to ${safeUrl}`)
      } catch (err: any) {
        console.error(`[workflow-engine] ${action.name}: webhook failed: ${err.message}`)
      }
      break
    }

    case 'update_field': {
      const entityId = payload.entity_id || payload.id || payload.after?.id
      if (!entityId || !config.field || config.value === undefined) break

      const table = validateEntityTable(config.entity_table)
      const field = validateFieldName(config.field)
      const value = typeof config.value === 'string'
        ? interpolateTemplate(config.value, payload)
        : config.value

      await db
        .from(table)
        .update({ [field]: value })
        .eq('id', entityId)
        .eq('account_id', accountId)

      console.log(`[workflow-engine] ${action.name}: updated ${table}.${field} on ${entityId}`)
      break
    }

    case 'emit_event': {
      if (!config.event_type) break

      await db.from('outbox_events').insert({
        account_id: accountId,
        event_type: config.event_type,
        entity_type: config.entity_type || payload.entity_type || null,
        entity_id: config.entity_id || payload.entity_id || null,
        payload: { ...payload, triggered_by_action: action.id },
      })

      console.log(`[workflow-engine] ${action.name}: emitted event ${config.event_type}`)
      break
    }

    case 'ai_prompt': {
      if (!config.user_prompt) break

      const context = { item: payload, ...payload }
      const systemPrompt = config.system_prompt
        ? interpolateTemplate(config.system_prompt, context)
        : undefined
      const userPrompt = interpolateTemplate(config.user_prompt, context)

      try {
        const aiResult = await callAI(systemPrompt, userPrompt, config.model)

        if (config.result_target && aiResult) {
          const entityId = payload.entity_id || payload.id || payload.after?.id
          if (entityId) {
            const table = validateEntityTable(config.entity_table)
            // Store result in metadata at the specified path
            const { data: current } = await db.from(table).select('metadata').eq('id', entityId).single()
            const metadata = { ...(current?.metadata || {}), [config.result_target]: aiResult }
            await db.from(table).update({ metadata }).eq('id', entityId)
          }
        }

        // Execute result_actions if AI returned structured data
        if (config.result_actions && aiResult && typeof aiResult === 'object') {
          const entityId = payload.entity_id || payload.id || payload.after?.id
          if (entityId) {
            const table = validateEntityTable(config.entity_table)
            for (const ra of config.result_actions) {
              if (ra.type === 'update_field' && ra.field && ra.source) {
                validateFieldName(ra.field)
                const val = getNestedValue(aiResult, ra.source)
                if (val !== undefined) {
                  await db.from(table).update({ [ra.field]: val }).eq('id', entityId)
                  console.log(`[workflow-engine] ${action.name}: AI result → ${ra.field} = ${val}`)
                }
              }
            }
          }
        }

        console.log(`[workflow-engine] ${action.name}: AI prompt executed`)
      } catch (err: any) {
        console.error(`[workflow-engine] ${action.name}: AI prompt failed: ${err.message}`)
      }
      break
    }

    case 'create_entity': {
      if (!config.entity_type) break

      const table = validateEntityTable(config.entity_type === 'ticket' ? 'tickets' : 'workflow_items')
      const fields: Record<string, any> = { account_id: accountId }

      if (config.field_mapping) {
        for (const [targetField, sourceExpr] of Object.entries(config.field_mapping)) {
          validateFieldName(targetField)
          fields[targetField] = typeof sourceExpr === 'string' && sourceExpr.startsWith('{{')
            ? interpolateTemplate(sourceExpr as string, payload)
            : sourceExpr
        }
      }

      const { data, error: dbErr } = await db.from(table).insert(fields).select().single()
      if (dbErr) {
        console.error(`[workflow-engine] ${action.name}: create_entity failed: ${dbErr.message}`)
      } else {
        console.log(`[workflow-engine] ${action.name}: created ${table} ${data.id}`)
      }
      break
    }

    case 'send_notification': {
      const message = config.message
        ? interpolateTemplate(config.message, payload)
        : `Action "${action.name}" triggered`

      await db.from('activity_events').insert({
        account_id: accountId,
        person_id: null,
        event_type: 'workflow_action.notification',
        entity_type: 'workflow_action',
        entity_id: action.id,
        summary: message,
        metadata: { action_name: action.name, channel: config.channel || 'activity' },
      })

      console.log(`[workflow-engine] ${action.name}: notification sent`)
      break
    }

    case 'schedule_timer': {
      const delayAmount = config.delay_amount || 0
      const delayUnit = config.delay_unit || 'minutes'
      let delayMs = delayAmount * 60 * 1000 // default minutes
      if (delayUnit === 'seconds') delayMs = delayAmount * 1000
      else if (delayUnit === 'hours') delayMs = delayAmount * 60 * 60 * 1000
      else if (delayUnit === 'days') delayMs = delayAmount * 24 * 60 * 60 * 1000

      const fireAt = new Date(Date.now() + delayMs)

      const { error: insErr } = await db.from('scheduled_trigger_instances').insert({
        trigger_id: null,
        account_id: accountId,
        fire_at: fireAt.toISOString(),
        status: 'pending',
        context: payload,
        action_type: config.nested_action_type || 'webhook',
        action_config: config.nested_action_config || {},
      })

      if (insErr) {
        console.error(`[workflow-engine] ${action.name}: schedule_timer insert failed: ${insErr.message}`)
      } else {
        console.log(`[workflow-engine] ${action.name}: scheduled timer for ${fireAt.toISOString()}`)
      }
      break
    }

    default: {
      // Look up custom action types registered for this account
      const { data: customType } = await db
        .from('custom_action_types')
        .select('handler_url, name')
        .eq('account_id', accountId)
        .eq('slug', action.action_type)
        .single()

      if (!customType) {
        console.warn(`[workflow-engine] Unknown action type: ${action.action_type}`)
        break
      }

      try {
        const safeHandlerUrl = validateOutboundUrl(customType.handler_url)
        const res = await fetch(safeHandlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_name: action.name,
            action_type: action.action_type,
            action_config: action.action_config,
            account_id: accountId,
            payload,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(15000),
        })
        console.log(`[workflow-engine] ${action.name}: custom action "${customType.name}" → ${res.status}`)
      } catch (err: any) {
        console.error(`[workflow-engine] ${action.name}: custom action failed: ${err.message}`)
      }
      break
    }
  }
}

async function callAI(
  systemPrompt: string | undefined,
  userPrompt: string,
  model?: string,
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[workflow-engine] No OPENAI_API_KEY configured, skipping AI call')
    return null
  }

  const messages: any[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: userPrompt })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content

  // Try to parse as JSON, fall back to raw string
  if (content) {
    try {
      return JSON.parse(content)
    } catch {
      return content
    }
  }
  return null
}

export async function executeWorkflowActions(
  accountId: string,
  workflowDefId: string,
  triggerType: string,
  triggerRefId: string | null,
  ctx: RequestContext,
  payload: Record<string, any>,
): Promise<void> {
  try {
    let query = db
      .from('workflow_actions')
      .select('*')
      .eq('workflow_definition_id', workflowDefId)
      .eq('trigger_type', triggerType)
      .eq('enabled', true)
      .order('position', { ascending: true })

    if (triggerRefId) {
      query = query.eq('trigger_ref_id', triggerRefId)
    } else {
      query = query.is('trigger_ref_id', null)
    }

    const { data: actions } = await query

    if (!actions || actions.length === 0) return

    for (const action of actions) {
      try {
        if (evaluateConditions(action.conditions, payload)) {
          await executeWorkflowAction(action, accountId, ctx, payload)

          await db.from('activity_events').insert({
            account_id: accountId,
            person_id: ctx.personId,
            event_type: 'workflow_action.executed',
            entity_type: 'workflow_action',
            entity_id: action.id,
            summary: `Action "${action.name}" executed (${triggerType})`,
            metadata: {
              trigger_type: triggerType,
              trigger_ref_id: triggerRefId,
              action_type: action.action_type,
            },
          })
        }
      } catch (err: any) {
        console.error(`[workflow-engine] Action ${action.id} (${action.name}) failed:`, err.message)
      }
    }
  } catch (err: any) {
    console.error('[workflow-engine] executeWorkflowActions failed:', err.message)
  }
}

// Exported for use by ai-invoke endpoint
export { callAI, interpolateTemplate, evaluateConditions }
