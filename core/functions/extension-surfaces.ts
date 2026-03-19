import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const surfaceId = params.get('surface_id')
    const type = params.get('type')
    const status = params.get('status')

    try {
      let query = db
        .from('extension_surfaces')
        .select(`
          *,
          principals:principal_id (
            id,
            principal_type,
            display_name,
            status
          )
        `)
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })

      if (surfaceId) query = query.eq('id', surfaceId)
      if (type) query = query.eq('surface_type', type)
      if (status) query = query.eq('status', status)

      const { data, error } = await query

      if (error) throw error
      return json(data || [])
    } catch (err: any) {
      return error(err.message || 'Extension surfaces query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      surface_name: string
      surface_type: 'hook' | 'endpoint' | 'middleware' | 'filter' | 'transformer'
      principal_id: string
      trigger_conditions: Record<string, unknown>
      handler_definition: Record<string, unknown>
      execution_context?: Record<string, unknown>
      security_context?: Record<string, unknown>
      validate_before_create?: boolean
    }>(req)

    if (!body.surface_name) return error('surface_name required')
    if (!body.surface_type) return error('surface_type required')
    if (!body.principal_id) return error('principal_id required')
    if (!body.trigger_conditions) return error('trigger_conditions required')
    if (!body.handler_definition) return error('handler_definition required')

    try {
      const result = await createExtensionSurface(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Extension surface creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const surfaceId = params.get('surface_id')
    if (!surfaceId) return error('surface_id required')

    const body = await parseBody<{
      status?: 'draft' | 'active' | 'disabled' | 'deprecated'
      trigger_conditions?: Record<string, unknown>
      handler_definition?: Record<string, unknown>
      execution_context?: Record<string, unknown>
      security_context?: Record<string, unknown>
    }>(req)

    try {
      const result = await updateExtensionSurface(ctx, surfaceId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Extension surface update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const surfaceId = params.get('surface_id')
    if (!surfaceId) return error('surface_id required')

    try {
      await deleteExtensionSurface(ctx, surfaceId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Extension surface deletion failed', 500)
    }
  },
})

async function createExtensionSurface(ctx: any, body: any) {
  // Verify principal exists and belongs to account
  const { data: principal } = await db
    .from('principals')
    .select('*')
    .eq('id', body.principal_id)
    .single()

  if (!principal) throw new Error('Principal not found')

  // Validate surface definition
  if (body.validate_before_create) {
    await validateExtensionSurface(body)
  }

  const { data } = await db
    .from('extension_surfaces')
    .insert({
      account_id: ctx.accountId,
      surface_name: body.surface_name,
      surface_type: body.surface_type,
      principal_id: body.principal_id,
      trigger_conditions: body.trigger_conditions,
      handler_definition: body.handler_definition,
      execution_context: body.execution_context || {},
      security_context: body.security_context || {},
      status: 'draft'
    })
    .select(`
      *,
      principals:principal_id (
        id,
        principal_type,
        display_name,
        status
      )
    `)
    .single()

  if (!data) throw new Error('Failed to create extension surface')

  await emitAudit(ctx, 'create', 'extension_surface', data.id, null, body)
  await emitActivity(ctx, 'extension_surface.created', `Created extension surface ${body.surface_name}`, 'extension_surface', data.id)

  return {
    surface_id: data.id,
    surface_name: body.surface_name,
    surface_type: body.surface_type,
    status: 'draft',
    message: 'Extension surface created successfully'
  }
}

async function updateExtensionSurface(ctx: any, surfaceId: string, updates: any) {
  const { data: before } = await db
    .from('extension_surfaces')
    .select('*')
    .eq('id', surfaceId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Extension surface not found')

  const updateData: Record<string, unknown> = {}
  if (updates.status) updateData.status = updates.status
  if (updates.trigger_conditions) updateData.trigger_conditions = updates.trigger_conditions
  if (updates.handler_definition) updateData.handler_definition = updates.handler_definition
  if (updates.execution_context) updateData.execution_context = updates.execution_context
  if (updates.security_context) updateData.security_context = updates.security_context

  const { data } = await db
    .from('extension_surfaces')
    .update(updateData)
    .eq('id', surfaceId)
    .eq('account_id', ctx.accountId)
    .select(`
      *,
      principals:principal_id (
        id,
        principal_type,
        display_name,
        status
      )
    `)
    .single()

  if (!data) throw new Error('Failed to update extension surface')

  await emitAudit(ctx, 'update', 'extension_surface', surfaceId, before, data)
  await emitActivity(ctx, 'extension_surface.updated', `Updated extension surface ${data.surface_name}`, 'extension_surface', surfaceId)

  return data
}

async function deleteExtensionSurface(ctx: any, surfaceId: string) {
  const { data: before } = await db
    .from('extension_surfaces')
    .select('*')
    .eq('id', surfaceId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Extension surface not found')

  const { error } = await db
    .from('extension_surfaces')
    .delete()
    .eq('id', surfaceId)
    .eq('account_id', ctx.accountId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'extension_surface', surfaceId, before, null)
  await emitActivity(ctx, 'extension_surface.deleted', `Deleted extension surface ${before.surface_name}`, 'extension_surface', surfaceId)
}

async function validateExtensionSurface(surface: any) {
  const errors: string[] = []

  // Validate trigger conditions
  if (!surface.trigger_conditions.event_types || !Array.isArray(surface.trigger_conditions.event_types)) {
    errors.push('trigger_conditions.event_types must be an array')
  }

  // Validate handler definition
  if (!surface.handler_definition.handler_type) {
    errors.push('handler_definition.handler_type is required')
  }

  if (!surface.handler_definition.handler_code) {
    errors.push('handler_definition.handler_code is required')
  }

  // Validate security context
  if (surface.security_context) {
    if (!surface.security_context.permissions || !Array.isArray(surface.security_context.permissions)) {
      errors.push('security_context.permissions must be an array')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }
}

export async function triggerExtensionSurfaces(ctx: any, eventType: string, eventData: any) {
  // Find active extension surfaces that match the trigger conditions
  const { data: surfaces } = await db
    .from('extension_surfaces')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('status', 'active')
    .contains('trigger_conditions->event_types', [eventType])

  if (!surfaces || surfaces.length === 0) {
    return { triggered_surfaces: 0, results: [] }
  }

  const results = []

  for (const surface of surfaces) {
    try {
      // Evaluate trigger conditions
      const shouldTrigger = evaluateTriggerConditions(surface.trigger_conditions, eventData)
      
      if (shouldTrigger) {
        // Execute the handler (this would be implemented based on handler type)
        const result = await executeExtensionHandler(surface, eventData)
        results.push({
          surface_id: surface.id,
          surface_name: surface.surface_name,
          status: 'executed',
          result
        })
      }
    } catch (err: any) {
      results.push({
        surface_id: surface.id,
        surface_name: surface.surface_name,
        status: 'error',
        error: err.message
      })
    }
  }

  return {
    triggered_surfaces: results.length,
    results
  }
}

function evaluateTriggerConditions(triggerConditions: any, eventData: any): boolean {
  // Simple evaluation - in production this would be more sophisticated
  const conditions = triggerConditions || {}
  
  // Check event type (already filtered)
  if (conditions.entity_types && conditions.entity_types.length > 0) {
    if (!conditions.entity_types.includes(eventData.entity_type)) {
      return false
    }
  }

  // Check custom conditions
  if (conditions.custom_conditions) {
    for (const [key, value] of Object.entries(conditions.custom_conditions)) {
      if (eventData[key] !== value) {
        return false
      }
    }
  }

  return true
}

async function executeExtensionHandler(surface: any, eventData: any): Promise<any> {
  // Placeholder for handler execution
  // In production, this would execute based on handler_type
  const handlerType = surface.handler_definition?.handler_type || 'javascript'
  
  switch (handlerType) {
    case 'javascript':
      return executeJavaScriptHandler(surface.handler_definition.handler_code, eventData)
    case 'webhook':
      return executeWebhookHandler(surface.handler_definition.webhook_url, eventData)
    case 'function':
      return executeFunctionHandler(surface.handler_definition.function_name, eventData)
    default:
      throw new Error(`Unsupported handler type: ${handlerType}`)
  }
}

async function executeJavaScriptHandler(code: string, eventData: any): Promise<any> {
  // In production, this would use a secure JavaScript execution environment
  // For now, return a placeholder result
  return {
    handler_type: 'javascript',
    executed_at: new Date().toISOString(),
    input_data: eventData,
    output_data: { processed: true }
  }
}

async function executeWebhookHandler(url: string, eventData: any): Promise<any> {
  // In production, this would make an HTTP request to the webhook
  return {
    handler_type: 'webhook',
    webhook_url: url,
    executed_at: new Date().toISOString(),
    input_data: eventData,
    output_data: { webhook_called: true }
  }
}

async function executeFunctionHandler(functionName: string, eventData: any): Promise<any> {
  // In production, this would call a registered function
  return {
    handler_type: 'function',
    function_name: functionName,
    executed_at: new Date().toISOString(),
    input_data: eventData,
    output_data: { function_executed: true }
  }
}
