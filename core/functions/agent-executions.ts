import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const executionId = params.get('execution_id')
    const contractId = params.get('contract_id')
    const status = params.get('status')
    const triggerType = params.get('trigger_type')
    const limit = parseInt(params.get('limit') || '50')
    const offset = parseInt(params.get('offset') || '0')

    try {
      let query = db
        .from('agent_executions_overview')
        .select('*')
        .eq('account_id', ctx.accountId)

      if (executionId) query = query.eq('id', executionId)
      if (contractId) query = query.eq('contract_id', contractId)
      if (status) query = query.eq('execution_status', status)
      if (triggerType) query = query.eq('trigger_type', triggerType)

      query = query.order('started_at', { ascending: false })

      if (limit > 0) query = query.limit(limit)
      if (offset > 0) query = query.range(offset, offset + limit - 1)

      const { data, error } = await query

      if (error) throw error
      return json(data || [])
    } catch (err: any) {
      return error(err.message || 'Agent executions query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      contract_id: string
      trigger_type: 'manual' | 'scheduled' | 'event' | 'webhook' | 'api'
      trigger_data?: Record<string, unknown>
      input_data?: Record<string, unknown>
      principal_id?: string
    }>(req)

    if (!body.contract_id) return error('contract_id required')
    if (!body.trigger_type) return error('trigger_type required')

    try {
      const result = await createAgentExecution(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent execution creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const executionId = params.get('execution_id')
    if (!executionId) return error('execution_id required')

    const body = await parseBody<{
      execution_status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
      output_data?: Record<string, unknown>
      error_message?: string
      logs?: Array<Record<string, unknown>>
      metrics?: Record<string, unknown>
    }>(req)

    try {
      const result = await updateAgentExecution(ctx, executionId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent execution update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const executionId = params.get('execution_id')
    if (!executionId) return error('execution_id required')

    try {
      await cancelAgentExecution(ctx, executionId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Agent execution cancellation failed', 500)
    }
  },
})

async function createAgentExecution(ctx: any, body: any) {
  // Resolve executing principal
  let principalId = body.principal_id
  if (!principalId) {
    const { data: principal } = await db
      .from('principals')
      .select('id')
      .eq('person_id', ctx.personId)
      .single()
    principalId = principal?.id
  }

  if (!principalId) throw new Error('Principal not found')

  // Verify contract exists and is active
  const { data: contract } = await db
    .from('agent_contracts')
    .select('*')
    .eq('id', body.contract_id)
    .eq('status', 'active')
    .single()

  if (!contract) throw new Error('Active agent contract not found')

  // Create execution
  const { data: execution } = await db.rpc('create_agent_execution', {
    execution_account_id: ctx.accountId,
    execution_contract_id: body.contract_id,
    execution_principal_id: principalId,
    trigger_type: body.trigger_type,
    trigger_data: body.trigger_data || {},
    input_data: body.input_data || {}
  })

  if (!execution) throw new Error('Failed to create agent execution')

  await emitAudit(ctx, 'create', 'agent_execution', execution, null, body)
  await emitActivity(ctx, 'agent_execution.created', `Created agent execution for ${contract.contract_name}`, 'agent_execution', execution)

  return {
    execution_id: execution,
    contract_id: body.contract_id,
    trigger_type: body.trigger_type,
    status: 'pending',
    message: 'Agent execution created successfully'
  }
}

async function updateAgentExecution(ctx: any, executionId: string, updates: any) {
  const { data: before } = await db
    .from('agent_executions')
    .select('*')
    .eq('id', executionId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Agent execution not found')

  // Validate status transitions
  if (updates.execution_status) {
    const validTransitions: Record<string, string[]> = {
      'pending': ['running', 'cancelled', 'failed'],
      'running': ['completed', 'failed', 'cancelled', 'timeout'],
      'completed': [],
      'failed': [],
      'cancelled': [],
      'timeout': []
    }

    const allowedStatuses = validTransitions[before.execution_status] || []
    if (!allowedStatuses.includes(updates.execution_status)) {
      throw new Error(`Invalid status transition from ${before.execution_status} to ${updates.execution_status}`)
    }
  }

  // Complete execution if status is terminal
  if (updates.execution_status && ['completed', 'failed', 'cancelled', 'timeout'].includes(updates.execution_status)) {
    await db.rpc('complete_agent_execution', {
      execution_id_param: executionId,
      execution_status: updates.execution_status,
      output_data: updates.output_data || {},
      error_message: updates.error_message || null,
      logs: updates.logs || [],
      metrics: updates.metrics || {}
    })
  } else {
    // Update non-terminal status
    const updateData: Record<string, unknown> = {}
    if (updates.execution_status) updateData.execution_status = updates.execution_status
    if (updates.output_data) updateData.output_data = updates.output_data
    if (updates.error_message !== undefined) updateData.error_message = updates.error_message
    if (updates.logs) updateData.logs = updates.logs
    if (updates.metrics) updateData.metrics = updates.metrics

    await db
      .from('agent_executions')
      .update(updateData)
      .eq('id', executionId)
      .eq('account_id', ctx.accountId)
  }

  // Get updated execution
  const { data } = await db
    .from('agent_executions_overview')
    .select('*')
    .eq('id', executionId)
    .single()

  await emitAudit(ctx, 'update', 'agent_execution', executionId, before, data)
  await emitActivity(ctx, 'agent_execution.updated', `Updated agent execution status to ${updates.execution_status}`, 'agent_execution', executionId)

  return data
}

async function cancelAgentExecution(ctx: any, executionId: string) {
  const { data: before } = await db
    .from('agent_executions')
    .select('*')
    .eq('id', executionId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Agent execution not found')

  // Only allow cancellation of pending or running executions
  if (!['pending', 'running'].includes(before.execution_status)) {
    throw new Error('Cannot cancel execution in terminal state')
  }

  await db.rpc('complete_agent_execution', {
    execution_id_param: executionId,
    execution_status: 'cancelled',
    output_data: {},
    error_message: null,
    logs: [],
    metrics: {}
  })

  await emitAudit(ctx, 'update', 'agent_execution', executionId, before, { execution_status: 'cancelled' })
  await emitActivity(ctx, 'agent_execution.cancelled', `Cancelled agent execution`, 'agent_execution', executionId)
}

export async function getAgentExecutionLogs(ctx: any, executionId: string) {
  const { data } = await db
    .from('agent_executions')
    .select('logs')
    .eq('id', executionId)
    .eq('account_id', ctx.accountId)
    .single()

  return data?.logs || []
}

export async function getAgentExecutionMetrics(ctx: any, executionId: string) {
  const { data } = await db
    .from('agent_executions')
    .select('metrics, duration_ms, resource_usage')
    .eq('id', executionId)
    .eq('account_id', ctx.accountId)
    .single()

  return {
    metrics: data?.metrics || {},
    duration_ms: data?.duration_ms,
    resource_usage: data?.resource_usage || {}
  }
}
