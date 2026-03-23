import { createHandler, requireAuth, requireTenant, requirePrincipalScope, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const capabilityId = params.get('capability_id')
    const category = params.get('category')
    const active = params.get('active')

    try {
      let query = db
        .from('agent_capabilities')
        .select('*')
        .order('capability_name', { ascending: true })

      if (capabilityId) query = query.eq('id', capabilityId)
      if (category) query = query.eq('capability_category', category)
      if (active !== undefined) query = query.eq('is_active', active === 'true')

      const { data, error } = await query

      if (error) throw error
      return json(data || [])
    } catch (err: any) {
      return error(err.message || 'Agent capabilities query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const scopeCheck = requirePrincipalScope(ctx, 'admin.integrations')
    if (scopeCheck) return scopeCheck

    const body = await parseBody<{
      capability_name: string
      capability_category: 'system' | 'data' | 'integration' | 'automation' | 'monitoring' | 'security'
      description?: string
      interface_definition?: Record<string, unknown>
      implementation_requirements?: Record<string, unknown>
      security_requirements?: Record<string, unknown>
      resource_requirements?: Record<string, unknown>
      is_system?: boolean
    }>(req)

    if (!body.capability_name) return error('capability_name required')
    if (!body.capability_category) return error('capability_category required')

    try {
      const result = await createAgentCapability(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent capability creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const scopeCheck = requirePrincipalScope(ctx, 'admin.integrations')
    if (scopeCheck) return scopeCheck

    const capabilityId = params.get('capability_id')
    if (!capabilityId) return error('capability_id required')

    const body = await parseBody<{
      capability_category?: string
      description?: string
      interface_definition?: Record<string, unknown>
      implementation_requirements?: Record<string, unknown>
      security_requirements?: Record<string, unknown>
      resource_requirements?: Record<string, unknown>
      is_active?: boolean
    }>(req)

    try {
      const result = await updateAgentCapability(ctx, capabilityId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Agent capability update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const scopeCheck = requirePrincipalScope(ctx, 'admin.integrations')
    if (scopeCheck) return scopeCheck

    const capabilityId = params.get('capability_id')
    if (!capabilityId) return error('capability_id required')

    try {
      await deleteAgentCapability(ctx, capabilityId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Agent capability deletion failed', 500)
    }
  },
})

async function createAgentCapability(ctx: any, body: any) {
  // Check if capability already exists
  const { data: existing } = await db
    .from('agent_capabilities')
    .select('id')
    .eq('capability_name', body.capability_name)
    .single()

  if (existing) throw new Error('Capability with this name already exists')

  const { data } = await db
    .from('agent_capabilities')
    .insert({
      capability_name: body.capability_name,
      capability_category: body.capability_category,
      description: body.description || null,
      interface_definition: body.interface_definition || {},
      implementation_requirements: body.implementation_requirements || {},
      security_requirements: body.security_requirements || {},
      resource_requirements: body.resource_requirements || {},
      is_system: body.is_system || false,
      is_active: true
    })
    .select()
    .single()

  if (!data) throw new Error('Failed to create agent capability')

  await emitAudit(ctx, 'create', 'agent_capability', data.id, null, body)
  await emitActivity(ctx, 'agent_capability.created', `Created agent capability ${body.capability_name}`, 'agent_capability', data.id)

  return {
    capability_id: data.id,
    capability_name: body.capability_name,
    category: body.capability_category,
    message: 'Agent capability created successfully'
  }
}

async function updateAgentCapability(ctx: any, capabilityId: string, updates: any) {
  const { data: before } = await db
    .from('agent_capabilities')
    .select('*')
    .eq('id', capabilityId)
    .single()

  if (!before) throw new Error('Agent capability not found')

  const updateData: Record<string, unknown> = {}
  if (updates.capability_category) updateData.capability_category = updates.capability_category
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.interface_definition) updateData.interface_definition = updates.interface_definition
  if (updates.implementation_requirements) updateData.implementation_requirements = updates.implementation_requirements
  if (updates.security_requirements) updateData.security_requirements = updates.security_requirements
  if (updates.resource_requirements) updateData.resource_requirements = updates.resource_requirements
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active

  const { data } = await db
    .from('agent_capabilities')
    .update(updateData)
    .eq('id', capabilityId)
    .select()
    .single()

  if (!data) throw new Error('Failed to update agent capability')

  await emitAudit(ctx, 'update', 'agent_capability', capabilityId, before, data)
  await emitActivity(ctx, 'agent_capability.updated', `Updated agent capability ${data.capability_name}`, 'agent_capability', capabilityId)

  return data
}

async function deleteAgentCapability(ctx: any, capabilityId: string) {
  const { data: before } = await db
    .from('agent_capabilities')
    .select('*')
    .eq('id', capabilityId)
    .single()

  if (!before) throw new Error('Agent capability not found')

  // Check if capability is in use by contracts
  const { data: contracts } = await db
    .from('agent_contract_capabilities')
    .select('contract_id')
    .eq('capability_id', capabilityId)
    .limit(1)

  if (contracts && contracts.length > 0) {
    throw new Error('Cannot delete capability that is in use by contracts')
  }

  const { error } = await db
    .from('agent_capabilities')
    .delete()
    .eq('id', capabilityId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'agent_capability', capabilityId, before, null)
  await emitActivity(ctx, 'agent_capability.deleted', `Deleted agent capability ${before.capability_name}`, 'agent_capability', capabilityId)
}

export async function registerSystemCapability(capabilityName: string, category: string, description?: string) {
  const { data } = await db.rpc('register_system_capability', {
    capability_name: capabilityName,
    capability_category: category,
    description: description || null,
    interface_definition: {},
    implementation_requirements: {}
  })

  return data
}

export async function getCapabilityUsage(capabilityId: string) {
  const { data } = await db
    .from('agent_contract_capabilities')
    .select(`
      contract_id,
      configuration,
      agent_contracts:contract_id (
        contract_name,
        contract_type,
        status
      )
    `)
    .eq('capability_id', capabilityId)

  return data || []
}
