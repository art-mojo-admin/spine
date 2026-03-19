import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const contractId = params.get('contract_id')
    const status = params.get('status')
    const type = params.get('type')
    const mode = params.get('mode') as 'overview' | 'executions' | 'capabilities'

    try {
      let result

      switch (mode) {
        case 'overview':
          result = await getContractsOverview(ctx.accountId!, contractId || undefined, status || undefined, type || undefined)
          break
        case 'executions':
          result = await getContractExecutions(ctx.accountId!, contractId || '')
          break
        case 'capabilities':
          result = await getContractCapabilities(ctx.accountId!, contractId || '')
          break
        default:
          result = await getContractsOverview(ctx.accountId!, contractId || undefined, status || undefined, type || undefined)
          break
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent contracts query failed', 500)
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
      contract_name: string
      contract_type: 'task' | 'workflow' | 'integration' | 'monitoring' | 'automation'
      principal_id: string
      contract_definition: Record<string, unknown>
      capabilities: string[]
      constraints?: Record<string, unknown>
      execution_config?: Record<string, unknown>
      resource_limits?: Record<string, unknown>
      security_policy?: Record<string, unknown>
      validate_before_create?: boolean
    }>(req)

    if (!body.contract_name) return error('contract_name required')
    if (!body.contract_type) return error('contract_type required')
    if (!body.principal_id) return error('principal_id required')
    if (!body.contract_definition) return error('contract_definition required')
    if (!body.capabilities) return error('capabilities required')

    try {
      const result = await createAgentContract(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent contract creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const contractId = params.get('contract_id')
    if (!contractId) return error('contract_id required')

    const body = await parseBody<{
      status?: 'draft' | 'active' | 'suspended' | 'deprecated'
      contract_definition?: Record<string, unknown>
      capabilities?: string[]
      constraints?: Record<string, unknown>
      execution_config?: Record<string, unknown>
      resource_limits?: Record<string, unknown>
      security_policy?: Record<string, unknown>
    }>(req)

    try {
      const result = await updateAgentContract(ctx, contractId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent contract update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const contractId = params.get('contract_id')
    if (!contractId) return error('contract_id required')

    try {
      await deleteAgentContract(ctx, contractId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Agent contract deletion failed', 500)
    }
  },
})

async function getContractsOverview(accountId: string, contractId?: string, status?: string, type?: string) {
  let query = db
    .from('agent_contracts_overview')
    .select('*')
    .eq('account_id', accountId)

  if (contractId) query = query.eq('id', contractId)
  if (status) query = query.eq('status', status)
  if (type) query = query.eq('contract_type', type)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getContractExecutions(accountId: string, contractId: string) {
  const { data, error } = await db
    .from('agent_executions_overview')
    .select('*')
    .eq('account_id', accountId)
    .eq('contract_id', contractId)
    .order('started_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getContractCapabilities(accountId: string, contractId: string) {
  const { data, error } = await db
    .from('agent_contract_capabilities')
    .select(`
      *,
      agent_capabilities:capability_id (
        capability_name,
        capability_category,
        description,
        interface_definition
      )
    `)
    .eq('contract_id', contractId)

  if (error) throw error
  return data || []
}

async function createAgentContract(ctx: any, body: any) {
  // Verify principal exists and belongs to account
  const { data: principal } = await db
    .from('principals')
    .select('*')
    .eq('id', body.principal_id)
    .single()

  if (!principal) throw new Error('Principal not found')

  // Create contract record
  const { data: contract } = await db
    .from('agent_contracts')
    .insert({
      account_id: ctx.accountId,
      contract_name: body.contract_name,
      contract_type: body.contract_type,
      principal_id: body.principal_id,
      contract_definition: body.contract_definition,
      capabilities: body.capabilities,
      constraints: body.constraints || {},
      execution_config: body.execution_config || {},
      resource_limits: body.resource_limits || {},
      security_policy: body.security_policy || {},
      status: 'draft'
    })
    .select()
    .single()

  if (!contract) throw new Error('Failed to create agent contract')

  // Validate contract if requested
  if (body.validate_before_create) {
    const validation = await validateAgentContract(contract.id)
    if (validation.some((v: any) => v.validation_status === 'failed')) {
      // Delete the contract since validation failed
      await db
        .from('agent_contracts')
        .delete()
        .eq('id', contract.id)

      throw new Error('Contract validation failed')
    }
  }

  // Add capabilities to contract
  if (body.capabilities && body.capabilities.length > 0) {
    const capabilityMappings = body.capabilities.map((capName: string) => {
      return {
        contract_id: contract.id,
        capability_id: capName, // This would need to be resolved to actual capability ID
        configuration: {}
      }
    })

    await db
      .from('agent_contract_capabilities')
      .insert(capabilityMappings)
  }

  await emitAudit(ctx, 'create', 'agent_contract', contract.id, null, body)
  await emitActivity(ctx, 'agent_contract.created', `Created agent contract ${body.contract_name}`, 'agent_contract', contract.id)

  return {
    contract_id: contract.id,
    contract_name: body.contract_name,
    status: 'draft',
    message: 'Agent contract created successfully'
  }
}

async function updateAgentContract(ctx: any, contractId: string, updates: any) {
  const { data: before } = await db
    .from('agent_contracts')
    .select('*')
    .eq('id', contractId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Agent contract not found')

  const updateData: Record<string, unknown> = {}
  if (updates.status) updateData.status = updates.status
  if (updates.contract_definition) updateData.contract_definition = updates.contract_definition
  if (updates.capabilities) updateData.capabilities = updates.capabilities
  if (updates.constraints) updateData.constraints = updates.constraints
  if (updates.execution_config) updateData.execution_config = updates.execution_config
  if (updates.resource_limits) updateData.resource_limits = updates.resource_limits
  if (updates.security_policy) updateData.security_policy = updates.security_policy

  const { data } = await db
    .from('agent_contracts')
    .update(updateData)
    .eq('id', contractId)
    .eq('account_id', ctx.accountId)
    .select()
    .single()

  // Update capabilities if changed
  if (updates.capabilities) {
    // Remove existing capabilities
    await db
      .from('agent_contract_capabilities')
      .delete()
      .eq('contract_id', contractId)

    // Add new capabilities
    if (updates.capabilities.length > 0) {
      const capabilityMappings = updates.capabilities.map((capName: string) => {
        return {
          contract_id: contractId,
          capability_id: capName, // This would need to be resolved to actual capability ID
          configuration: {}
        }
      })

      await db
        .from('agent_contract_capabilities')
        .insert(capabilityMappings)
    }
  }

  await emitAudit(ctx, 'update', 'agent_contract', contractId, before, data)
  await emitActivity(ctx, 'agent_contract.updated', `Updated agent contract ${data.contract_name}`, 'agent_contract', contractId)

  return data
}

async function deleteAgentContract(ctx: any, contractId: string) {
  const { data: before } = await db
    .from('agent_contracts')
    .select('*')
    .eq('id', contractId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Agent contract not found')

  // Check if contract has active executions
  const { data: activeExecutions } = await db
    .from('agent_executions')
    .select('id')
    .eq('contract_id', contractId)
    .in('execution_status', ['pending', 'running'])
    .limit(1)

  if (activeExecutions && activeExecutions.length > 0) {
    throw new Error('Cannot delete contract with active executions')
  }

  const { error } = await db
    .from('agent_contracts')
    .delete()
    .eq('id', contractId)
    .eq('account_id', ctx.accountId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'agent_contract', contractId, before, null)
  await emitActivity(ctx, 'agent_contract.deleted', `Deleted agent contract ${before.contract_name}`, 'agent_contract', contractId)
}

async function validateAgentContract(contractId: string) {
  const { data } = await db.rpc('validate_agent_contract', {
    contract_id: contractId
  })

  return data || []
}

export async function executeAgentContract(ctx: any, contractId: string, triggerType: string, triggerData: any, inputData: any) {
  // Resolve executing principal
  const { data: principal } = await db
    .from('principals')
    .select('id')
    .eq('person_id', ctx.personId)
    .single()

  if (!principal) throw new Error('Principal not found')

  // Create execution
  const { data: execution } = await db.rpc('create_agent_execution', {
    execution_account_id: ctx.accountId,
    execution_contract_id: contractId,
    execution_principal_id: principal.id,
    trigger_type: triggerType,
    trigger_data: triggerData || {},
    input_data: inputData || {}
  })

  if (!execution) throw new Error('Failed to create agent execution')

  await emitAudit(ctx, 'create', 'agent_execution', execution, null, { contract_id: contractId, trigger_type: triggerType })
  await emitActivity(ctx, 'agent_execution.started', `Started agent execution`, 'agent_execution', execution)

  return {
    execution_id: execution,
    contract_id: contractId,
    trigger_type: triggerType,
    status: 'pending',
    message: 'Agent execution initiated'
  }
}
