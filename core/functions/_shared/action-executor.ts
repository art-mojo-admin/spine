/**
 * Shared action executor — used by workflow-engine, trigger-scheduler, and automations.
 */
import { db } from './db'
import { validateOutboundUrl, validateEntityTable, validateFieldName } from './security'

interface ActionDef {
  id?: string
  name: string
  action_type: string
  action_config: Record<string, any>
}

export function interpolateTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = getNestedValue(context, path.trim())
    return value !== undefined && value !== null ? String(value) : ''
  })
}

export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

export function evaluateConditions(conditions: any[], payload: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((cond: any) => {
    const value = getNestedValue(payload, cond.field)
    switch (cond.operator) {
      case 'equals': return value === cond.value
      case 'not_equals': return value !== cond.value
      case 'contains': return typeof value === 'string' && value.includes(cond.value)
      case 'in': return Array.isArray(cond.value) && cond.value.includes(value)
      case 'exists': return value !== undefined && value !== null
      case 'not_exists': return value === undefined || value === null
      case 'gt': return typeof value === 'number' && value > cond.value
      case 'lt': return typeof value === 'number' && value < cond.value
      case 'gte': return typeof value === 'number' && value >= cond.value
      case 'lte': return typeof value === 'number' && value <= cond.value
      default: return true
    }
  })
}

export async function executeAction(
  action: ActionDef,
  accountId: string,
  payload: Record<string, any>,
): Promise<{ success: boolean; detail?: string }> {
  const config = action.action_config

  try {
    switch (action.action_type) {
      case 'webhook': {
        if (!config.url) return { success: false, detail: 'No URL configured' }
        const url = interpolateTemplate(config.url, payload)
        const body = config.body_template
          ? interpolateTemplate(JSON.stringify(config.body_template), payload)
          : JSON.stringify({
              action_name: action.name,
              payload,
              timestamp: new Date().toISOString(),
            })

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (config.headers) {
          for (const [k, v] of Object.entries(config.headers)) {
            headers[k] = interpolateTemplate(String(v), payload)
          }
        }

        const safeUrl = validateOutboundUrl(url)
        const res = await fetch(safeUrl, {
          method: config.method || 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10000),
        })
        console.log(`[action-executor] ${action.name}: webhook ${res.status} → ${safeUrl}`)
        return { success: res.ok, detail: `HTTP ${res.status}` }
      }

      case 'update_field': {
        const entityId = payload.entity_id || payload.id || payload.after?.id
        if (!entityId || !config.field || config.value === undefined) {
          return { success: false, detail: 'Missing entity_id, field, or value' }
        }
        const table = validateEntityTable(config.entity_table)
        const field = validateFieldName(config.field)
        const value = typeof config.value === 'string'
          ? interpolateTemplate(config.value, payload)
          : config.value

        await db.from(table).update({ [field]: value }).eq('id', entityId).eq('account_id', accountId)
        console.log(`[action-executor] ${action.name}: updated ${table}.${config.field} on ${entityId}`)
        return { success: true }
      }

      case 'emit_event': {
        if (!config.event_type) return { success: false, detail: 'No event_type' }
        await db.from('outbox_events').insert({
          account_id: accountId,
          event_type: config.event_type,
          entity_type: config.entity_type || payload.entity_type || null,
          entity_id: config.entity_id || payload.entity_id || null,
          payload: { ...payload, triggered_by: action.name },
        })
        console.log(`[action-executor] ${action.name}: emitted ${config.event_type}`)
        return { success: true }
      }

      case 'create_entity': {
        if (!config.entity_type) return { success: false, detail: 'No entity_type' }
        const table = validateEntityTable('items')
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
          console.error(`[action-executor] ${action.name}: create_entity failed: ${dbErr.message}`)
          return { success: false, detail: dbErr.message }
        }
        console.log(`[action-executor] ${action.name}: created ${table} ${data.id}`)
        return { success: true }
      }

      case 'send_notification': {
        const message = config.message
          ? interpolateTemplate(config.message, payload)
          : `Action "${action.name}" triggered`

        await db.from('activity_events').insert({
          account_id: accountId,
          person_id: null,
          event_type: 'scheduled_trigger.notification',
          entity_type: 'scheduled_trigger',
          entity_id: action.id || null,
          summary: message,
          metadata: { action_name: action.name, channel: config.channel || 'activity' },
        })
        console.log(`[action-executor] ${action.name}: notification sent`)
        return { success: true }
      }

      case 'ai_prompt': {
        if (!config.user_prompt) return { success: false, detail: 'No user_prompt' }
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) return { success: false, detail: 'No OPENAI_API_KEY' }

        const context = { item: payload, ...payload }
        const systemPrompt = config.system_prompt ? interpolateTemplate(config.system_prompt, context) : undefined
        const userPrompt = interpolateTemplate(config.user_prompt, context)

        const messages: any[] = []
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
        messages.push({ role: 'user', content: userPrompt })

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: config.model || 'gpt-4o-mini', messages, temperature: 0.3 }),
          signal: AbortSignal.timeout(30000),
        })

        if (!res.ok) return { success: false, detail: `OpenAI ${res.status}` }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        console.log(`[action-executor] ${action.name}: AI prompt executed`)

        // Store result if configured
        if (config.result_target && content) {
          const entityId = payload.entity_id || payload.id
          if (entityId) {
            const table = validateEntityTable(config.entity_table)
            const { data: current } = await db.from(table).select('metadata').eq('id', entityId).single()
            let parsed = content
            try { parsed = JSON.parse(content) } catch {}
            const metadata = { ...(current?.metadata || {}), [config.result_target]: parsed }
            await db.from(table).update({ metadata }).eq('id', entityId)
          }
        }
        return { success: true }
      }

      case 'send_email': {
        const to = config.to
          ? interpolateTemplate(config.to, payload)
          : null
        if (!to) return { success: false, detail: 'No recipient (to) configured' }

        const subject = config.subject
          ? interpolateTemplate(config.subject, payload)
          : `Notification from ${action.name}`
        const bodyHtml = config.body_html
          ? interpolateTemplate(config.body_html, payload)
          : undefined
        const bodyText = config.body_text
          ? interpolateTemplate(config.body_text, payload)
          : undefined

        const provider = process.env.EMAIL_PROVIDER || config.provider || 'webhook'
        const apiKey = process.env.EMAIL_API_KEY || config.api_key

        if (provider === 'resend') {
          if (!apiKey) return { success: false, detail: 'No EMAIL_API_KEY for Resend' }
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              from: config.from || process.env.EMAIL_FROM || 'noreply@example.com',
              to: [to],
              subject,
              html: bodyHtml,
              text: bodyText,
            }),
            signal: AbortSignal.timeout(10000),
          })
          if (!res.ok) {
            const err = await res.text()
            return { success: false, detail: `Resend ${res.status}: ${err}` }
          }
          console.log(`[action-executor] ${action.name}: email sent via Resend to ${to}`)
          return { success: true }
        }

        if (provider === 'sendgrid') {
          if (!apiKey) return { success: false, detail: 'No EMAIL_API_KEY for SendGrid' }
          const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to }] }],
              from: { email: config.from || process.env.EMAIL_FROM || 'noreply@example.com' },
              subject,
              content: [
                ...(bodyText ? [{ type: 'text/plain', value: bodyText }] : []),
                ...(bodyHtml ? [{ type: 'text/html', value: bodyHtml }] : []),
              ],
            }),
            signal: AbortSignal.timeout(10000),
          })
          if (!res.ok) {
            const err = await res.text()
            return { success: false, detail: `SendGrid ${res.status}: ${err}` }
          }
          console.log(`[action-executor] ${action.name}: email sent via SendGrid to ${to}`)
          return { success: true }
        }

        // Fallback: webhook (send to Make.com or similar)
        const webhookUrl = config.webhook_url || process.env.EMAIL_WEBHOOK_URL
        if (!webhookUrl) return { success: false, detail: 'No webhook_url or EMAIL_WEBHOOK_URL configured for email' }

        const safeWebhookUrl = validateOutboundUrl(webhookUrl)
        const res = await fetch(safeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, body_html: bodyHtml, body_text: bodyText, action_name: action.name, payload }),
          signal: AbortSignal.timeout(10000),
        })
        console.log(`[action-executor] ${action.name}: email webhook ${res.status} → ${safeWebhookUrl}`)
        return { success: res.ok, detail: `HTTP ${res.status}` }
      }

      case 'create_link': {
        if (!config.source_type || !config.target_type || !config.link_type) {
          return { success: false, detail: 'source_type, target_type, and link_type required' }
        }
        const sourceId = config.source_id
          ? (typeof config.source_id === 'string' ? interpolateTemplate(config.source_id, payload) : config.source_id)
          : payload.entity_id || payload.id || payload.after?.id
        const targetId = config.target_id
          ? (typeof config.target_id === 'string' ? interpolateTemplate(config.target_id, payload) : config.target_id)
          : null

        if (!sourceId || !targetId) {
          return { success: false, detail: 'Could not resolve source_id or target_id' }
        }

        const linkMeta = config.metadata || {}
        const { error: linkErr } = await db.from('entity_links').insert({
          account_id: accountId,
          source_type: config.source_type,
          source_id: sourceId,
          target_type: config.target_type,
          target_id: targetId,
          link_type: config.link_type,
          metadata: linkMeta,
        })

        if (linkErr) {
          if (linkErr.code === '23505') {
            console.log(`[action-executor] ${action.name}: link already exists, skipping`)
            return { success: true, detail: 'Link already exists' }
          }
          return { success: false, detail: linkErr.message }
        }
        console.log(`[action-executor] ${action.name}: created link ${config.source_type}→${config.target_type} (${config.link_type})`)
        return { success: true }
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
          console.warn(`[action-executor] Unknown action type: ${action.action_type}`)
          return { success: false, detail: `Unknown action type: ${action.action_type}` }
        }

        // Delegate to the custom handler URL
        const handlerBody = JSON.stringify({
          action_name: action.name,
          action_type: action.action_type,
          action_config: config,
          account_id: accountId,
          payload,
          timestamp: new Date().toISOString(),
        })

        const safeHandlerUrl = validateOutboundUrl(customType.handler_url)
        const res = await fetch(safeHandlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: handlerBody,
          signal: AbortSignal.timeout(15000),
        })

        console.log(`[action-executor] ${action.name}: custom action "${customType.name}" → ${res.status}`)
        return { success: res.ok, detail: `HTTP ${res.status}` }
      }
    }
  } catch (err: any) {
    console.error(`[action-executor] ${action.name} failed:`, err.message)
    return { success: false, detail: err.message }
  }
}
