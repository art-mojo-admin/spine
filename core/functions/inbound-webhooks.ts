import { db } from './_shared/db'
import { emitActivity, emitOutboxEvent } from './_shared/audit'
import { executeWorkflowActions } from './_shared/workflow-engine'
import type { RequestContext } from './_shared/middleware'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS })
}

function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: CORS_HEADERS })
}

async function authenticateApiKey(req: Request): Promise<{ accountId: string; keyId: string } | null> {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (!apiKey) return null

  const { data } = await db
    .from('inbound_webhook_keys')
    .select('id, account_id, enabled')
    .eq('api_key', apiKey)
    .single()

  if (!data || !data.enabled) return null

  // Update last_used_at
  await db.from('inbound_webhook_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)

  return { accountId: data.account_id, keyId: data.id }
}

function interpolate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = path.trim().split('.').reduce((acc: any, key: string) => acc?.[key], context)
    return value !== undefined && value !== null ? String(value) : ''
  })
}

async function executeMapping(
  mapping: any,
  payload: Record<string, any>,
  accountId: string,
  ctx: RequestContext,
): Promise<{ success: boolean; detail: string }> {
  const config = mapping.action_config
  const context = { payload, ...payload }

  switch (mapping.action) {
    case 'transition_item': {
      // Find the workflow item
      const itemId = config.item_id_field
        ? interpolate(config.item_id_field, context)
        : payload.item_id || payload.entity_id

      if (!itemId) return { success: false, detail: 'No item_id resolved' }

      const { data: item } = await db
        .from('items')
        .select('*')
        .eq('id', itemId)
        .eq('account_id', accountId)
        .single()

      if (!item) return { success: false, detail: `Item ${itemId} not found` }

      // Resolve target stage — by transition name or stage name or ID
      let targetStageId = config.target_stage_id
      let transitionDef: any = null

      if (config.transition_name) {
        const tName = interpolate(config.transition_name, context)
        const { data: td } = await db
          .from('transition_definitions')
          .select('*')
          .eq('workflow_definition_id', item.workflow_definition_id)
          .eq('from_stage_id', item.stage_definition_id)
          .ilike('name', tName)
          .limit(1)
          .single()

        if (td) {
          transitionDef = td
          targetStageId = td.to_stage_id
        }
      } else if (config.target_stage_name) {
        const sName = interpolate(config.target_stage_name, context)
        const { data: stage } = await db
          .from('stage_definitions')
          .select('id')
          .eq('workflow_definition_id', item.workflow_definition_id)
          .ilike('name', sName)
          .single()

        if (stage) targetStageId = stage.id
      }

      if (!targetStageId) return { success: false, detail: 'Could not resolve target stage' }

      // Execute on_exit actions
      await executeWorkflowActions(accountId, item.workflow_definition_id, 'on_exit_stage', item.stage_definition_id, ctx, { ...item, entity_id: itemId })

      // Execute on_transition actions
      if (transitionDef) {
        await executeWorkflowActions(accountId, item.workflow_definition_id, 'on_transition', transitionDef.id, ctx, { ...item, entity_id: itemId, transition: transitionDef })
      }

      // Update the item
      const { data: updated, error: dbErr } = await db
        .from('items')
        .update({ stage_definition_id: targetStageId })
        .eq('id', itemId)
        .select()
        .single()

      if (dbErr) return { success: false, detail: dbErr.message }

      // Execute on_enter actions
      await executeWorkflowActions(accountId, item.workflow_definition_id, 'on_enter_stage', targetStageId, ctx, { ...updated, entity_id: itemId, transition: transitionDef })

      // Emit events
      const transitionMeta = transitionDef ? { transition_id: transitionDef.id, transition_name: transitionDef.name } : {}
      await emitActivity(ctx, 'item.stage_changed', `"${updated.title}" transitioned via inbound webhook`, 'item', itemId, { ...transitionMeta, source: 'inbound_webhook' })
      await emitOutboxEvent(accountId, 'item.stage_changed', 'item', itemId, { before: item, after: updated, ...transitionMeta, source: 'inbound_webhook' })

      return { success: true, detail: `Transitioned "${updated.title}" to stage ${targetStageId}` }
    }

    case 'update_item_field': {
      const itemId = config.item_id_field
        ? interpolate(config.item_id_field, context)
        : payload.item_id || payload.entity_id

      if (!itemId) return { success: false, detail: 'No item_id resolved' }

      const updates: Record<string, any> = {}
      if (config.field_updates) {
        for (const [field, valueExpr] of Object.entries(config.field_updates)) {
          updates[field] = typeof valueExpr === 'string'
            ? interpolate(valueExpr, context)
            : valueExpr
        }
      }

      if (Object.keys(updates).length === 0) return { success: false, detail: 'No field updates configured' }

      const { error: dbErr } = await db
        .from('items')
        .update(updates)
        .eq('id', itemId)
        .eq('account_id', accountId)

      if (dbErr) return { success: false, detail: dbErr.message }

      await emitActivity(ctx, 'item.updated', `Updated item ${itemId} via inbound webhook`, 'item', itemId, { fields: Object.keys(updates), source: 'inbound_webhook' })

      return { success: true, detail: `Updated fields: ${Object.keys(updates).join(', ')}` }
    }

    case 'create_item': {
      if (!config.workflow_definition_id) return { success: false, detail: 'workflow_definition_id required in config' }

      const { data: initialStage } = await db
        .from('stage_definitions')
        .select('id')
        .eq('workflow_definition_id', config.workflow_definition_id)
        .eq('is_initial', true)
        .single()

      const fields: Record<string, any> = {
        account_id: accountId,
        workflow_definition_id: config.workflow_definition_id,
        stage_definition_id: initialStage?.id,
        item_type: config.item_type || 'task',
        title: config.title_template ? interpolate(config.title_template, context) : payload.title || 'Untitled',
        description: config.description_template ? interpolate(config.description_template, context) : payload.description || null,
        priority: payload.priority || config.priority || 'medium',
        metadata: { ...(config.metadata || {}), inbound_payload: payload },
      }

      const { data, error: dbErr } = await db.from('items').insert(fields).select().single()
      if (dbErr) return { success: false, detail: dbErr.message }

      // Execute on_create actions
      await executeWorkflowActions(accountId, config.workflow_definition_id, 'on_create', null, ctx, { ...data, entity_id: data.id })

      await emitActivity(ctx, 'item.created', `Created "${data.title}" via inbound webhook`, 'item', data.id, { source: 'inbound_webhook' })
      await emitOutboxEvent(accountId, 'item.created', 'item', data.id, { ...data, source: 'inbound_webhook' })

      return { success: true, detail: `Created item "${data.title}" (${data.id})` }
    }

    case 'emit_event': {
      const eventType = config.event_type
        ? interpolate(config.event_type, context)
        : payload.event_type

      if (!eventType) return { success: false, detail: 'No event_type resolved' }

      await emitOutboxEvent(accountId, eventType, config.entity_type || null, config.entity_id || null, { ...payload, source: 'inbound_webhook' })

      return { success: true, detail: `Emitted event ${eventType}` }
    }

    default:
      return { success: false, detail: `Unknown action: ${mapping.action}` }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate via API key
  const auth = await authenticateApiKey(req)
  if (!auth) {
    return errorResponse('Invalid or missing API key', 401)
  }

  // Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const eventName = body.event || body.event_name || body.event_type
  if (!eventName) {
    return errorResponse('Missing event name (provide "event", "event_name", or "event_type" in body)')
  }

  // Build a minimal RequestContext for the engine
  const ctx: RequestContext = {
    requestId: crypto.randomUUID(),
    personId: null,
    accountId: auth.accountId,
    accountRole: 'operator',
    systemRole: null,
    authUid: null,
    impersonating: false,
    realPersonId: null,
    impersonationSessionId: null,
  }

  // Find matching mappings
  const { data: mappings } = await db
    .from('inbound_webhook_mappings')
    .select('*')
    .eq('account_id', auth.accountId)
    .eq('event_name', eventName)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (!mappings || mappings.length === 0) {
    return jsonResponse({ received: true, event: eventName, mappings_matched: 0, results: [] })
  }

  // Execute each mapping
  const results: any[] = []
  for (const mapping of mappings) {
    try {
      const result = await executeMapping(mapping, body.payload || body, auth.accountId, ctx)
      results.push({ mapping_id: mapping.id, mapping_name: mapping.name, ...result })
    } catch (err: any) {
      results.push({ mapping_id: mapping.id, mapping_name: mapping.name, success: false, detail: err.message })
    }
  }

  // Log the inbound event
  await emitActivity(ctx, 'inbound_webhook.received', `Inbound webhook: ${eventName} (${results.length} mapping(s))`, 'inbound_webhook_key', auth.keyId, {
    event_name: eventName,
    results_count: results.length,
    success_count: results.filter((r) => r.success).length,
  })

  return jsonResponse({
    received: true,
    event: eventName,
    mappings_matched: mappings.length,
    results,
  })
}
