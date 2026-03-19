import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const utilityId = params.get('utility_id')
    const category = params.get('category')
    const active = params.get('active')

    try {
      let query = db
        .from('helper_utilities')
        .select('*')
        .order('utility_name', { ascending: true })

      if (utilityId) query = query.eq('id', utilityId)
      if (category) query = query.eq('utility_category', category)
      if (active !== undefined) query = query.eq('is_active', active === 'true')

      const { data, error } = await query

      if (error) throw error
      return json(data || [])
    } catch (err: any) {
      return error(err.message || 'Helper utilities query failed', 500)
    }
  },

  async POST(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    // Check if this is an execute request
    if (params.get('action') === 'execute') {
      const utilityName = params.get('utility_name')
      if (!utilityName) return error('utility_name required')

      const body = await parseBody<{
        input_data: Record<string, unknown>
      }>(req)

      if (!body.input_data) return error('input_data required')

      try {
        const result = await executeHelperUtility(ctx, utilityName, body.input_data)
        return json(result)
      } catch (err: any) {
        return error(err.message || 'Helper utility execution failed', 500)
      }
    }

    // Otherwise, this is a create request
    const body = await parseBody<{
      utility_name: string
      utility_category: string
      description?: string
      input_schema: Record<string, unknown>
      output_schema: Record<string, unknown>
      implementation: Record<string, unknown>
      is_active?: boolean
    }>(req)

    if (!body.utility_name || !body.utility_category || !body.implementation) {
      return error('utility_name, utility_category, and implementation required')
    }

    try {
      const data = await createHelperUtility(ctx, body)
      return json(data, 201)
    } catch (err: any) {
      return error(err.message || 'Helper utility creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      description?: string
      input_schema?: Record<string, unknown>
      output_schema?: Record<string, unknown>
      implementation?: Record<string, unknown>
      is_active?: boolean
    }>(req)

    if (!body) return error('Request body required')

    const utilityId = params.get('id')
    if (!utilityId) return error('id required')

    try {
      const data = await updateHelperUtility(ctx, utilityId, body)
      return json(data)
    } catch (err: any) {
      return error(err.message || 'Helper utility update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const utilityId = params.get('id')
    if (!utilityId) return error('id required')

    try {
      await deleteHelperUtility(ctx, utilityId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Helper utility deletion failed', 500)
    }
  },
})

async function createHelperUtility(ctx: any, body: any) {
  // Check if utility already exists
  const { data: existing } = await db
    .from('helper_utilities')
    .select('id')
    .eq('utility_name', body.utility_name)
    .single()

  if (existing) throw new Error('Utility with this name already exists')

  const { data } = await db
    .from('helper_utilities')
    .insert({
      utility_name: body.utility_name,
      utility_category: body.utility_category,
      description: body.description || null,
      input_schema: body.input_schema || {},
      output_schema: body.output_schema || {},
      implementation_code: body.implementation_code || null,
      dependencies: body.dependencies || [],
      is_system: body.is_system || false,
      is_active: true
    })
    .select()
    .single()

  if (!data) throw new Error('Failed to create helper utility')

  await emitAudit(ctx, 'create', 'helper_utility', data.id, null, body)
  await emitActivity(ctx, 'helper_utility.created', `Created helper utility ${body.utility_name}`, 'helper_utility', data.id)

  return {
    utility_id: data.id,
    utility_name: body.utility_name,
    category: body.utility_category,
    message: 'Helper utility created successfully'
  }
}

async function updateHelperUtility(ctx: any, utilityId: string, updates: any) {
  const { data: before } = await db
    .from('helper_utilities')
    .select('*')
    .eq('id', utilityId)
    .single()

  if (!before) throw new Error('Helper utility not found')

  const updateData: Record<string, unknown> = {}
  if (updates.utility_category) updateData.utility_category = updates.utility_category
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.input_schema) updateData.input_schema = updates.input_schema
  if (updates.output_schema) updateData.output_schema = updates.output_schema
  if (updates.implementation_code) updateData.implementation_code = updates.implementation_code
  if (updates.dependencies) updateData.dependencies = updates.dependencies
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active

  const { data } = await db
    .from('helper_utilities')
    .update(updateData)
    .eq('id', utilityId)
    .select()
    .single()

  if (!data) throw new Error('Failed to update helper utility')

  await emitAudit(ctx, 'update', 'helper_utility', utilityId, before, data)
  await emitActivity(ctx, 'helper_utility.updated', `Updated helper utility ${data.utility_name}`, 'helper_utility', utilityId)

  return data
}

async function deleteHelperUtility(ctx: any, utilityId: string) {
  const { data: before } = await db
    .from('helper_utilities')
    .select('*')
    .eq('id', utilityId)
    .single()

  if (!before) throw new Error('Helper utility not found')

  const { error } = await db
    .from('helper_utilities')
    .delete()
    .eq('id', utilityId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'helper_utility', utilityId, before, null)
  await emitActivity(ctx, 'helper_utility.deleted', `Deleted helper utility ${before.utility_name}`, 'helper_utility', utilityId)
}

async function executeHelperUtility(ctx: any, utilityName: string, inputData: any) {
  // Get utility definition
  const { data: utility } = await db
    .from('helper_utilities')
    .select('*')
    .eq('utility_name', utilityName)
    .eq('is_active', true)
    .single()

  if (!utility) throw new Error('Helper utility not found or inactive')

  // Validate input data against schema
  if (utility.input_schema && Object.keys(utility.input_schema).length > 0) {
    validateInputData(inputData, utility.input_schema)
  }

  // Execute utility based on category
  let result
  switch (utility.utility_category) {
    case 'validation':
      result = executeValidationUtility(utility, inputData)
      break
    case 'transformation':
      result = executeTransformationUtility(utility, inputData)
      break
    case 'calculation':
      result = executeCalculationUtility(utility, inputData)
      break
    case 'formatting':
      result = executeFormattingUtility(utility, inputData)
      break
    case 'security':
      result = executeSecurityUtility(utility, inputData)
      break
    case 'integration':
      result = executeIntegrationUtility(utility, inputData)
      break
    default:
      throw new Error(`Unsupported utility category: ${utility.utility_category}`)
  }

  // Validate output data against schema
  if (utility.output_schema && Object.keys(utility.output_schema).length > 0) {
    validateOutputData(result, utility.output_schema)
  }

  await emitAudit(ctx, 'execute', 'helper_utility', utility.id, null, { input_data: inputData, output_data: result })
  await emitActivity(ctx, 'helper_utility.executed', `Executed helper utility ${utilityName}`, 'helper_utility', utility.id)

  return {
    utility_name: utilityName,
    utility_category: utility.utility_category,
    input_data: inputData,
    output_data: result,
    executed_at: new Date().toISOString()
  }
}

function validateInputData(inputData: any, schema: any) {
  // Simple validation - in production this would be more sophisticated
  for (const [field, rules] of Object.entries(schema)) {
    const fieldRules = rules as any
    if (fieldRules.required && !(field in inputData)) {
      throw new Error(`Required field missing: ${field}`)
    }
    if (field in inputData && fieldRules.type && typeof inputData[field] !== fieldRules.type) {
      throw new Error(`Invalid type for field ${field}: expected ${fieldRules.type}, got ${typeof inputData[field]}`)
    }
  }
}

function validateOutputData(outputData: any, schema: any) {
  // Simple validation - in production this would be more sophisticated
  for (const [field, rules] of Object.entries(schema)) {
    const fieldRules = rules as any
    if (fieldRules.required && !(field in outputData)) {
      throw new Error(`Required output field missing: ${field}`)
    }
    if (field in outputData && fieldRules.type && typeof outputData[field] !== fieldRules.type) {
      throw new Error(`Invalid output type for field ${field}: expected ${fieldRules.type}, got ${typeof outputData[field]}`)
    }
  }
}

function executeValidationUtility(utility: any, inputData: any) {
  // Placeholder for validation utilities
  return {
    is_valid: true,
    errors: [],
    warnings: [],
    validated_fields: Object.keys(inputData)
  }
}

function executeTransformationUtility(utility: any, inputData: any) {
  // Placeholder for transformation utilities
  return {
    transformed_data: inputData,
    transformation_applied: utility.utility_name,
    fields_processed: Object.keys(inputData)
  }
}

function executeCalculationUtility(utility: any, inputData: any) {
  // Placeholder for calculation utilities
  return {
    calculation_result: 0,
    calculation_type: utility.utility_name,
    input_processed: true
  }
}

function executeFormattingUtility(utility: any, inputData: any) {
  // Placeholder for formatting utilities
  return {
    formatted_data: inputData,
    format_applied: utility.utility_name,
    formatted_fields: Object.keys(inputData)
  }
}

function executeSecurityUtility(utility: any, inputData: any) {
  // Placeholder for security utilities
  return {
    security_result: 'passed',
    security_checks: ['validation', 'sanitization'],
    secured_data: inputData
  }
}

function executeIntegrationUtility(utility: any, inputData: any) {
  // Placeholder for integration utilities
  return {
    integration_result: 'success',
    integration_type: utility.utility_name,
    external_call_made: false,
    response_data: {}
  }
}

export async function registerHelperUtility(
  utilityName: string,
  category: string,
  description?: string,
  inputSchema?: any,
  outputSchema?: any,
  implementationCode?: string
) {
  const { data } = await db.rpc('register_helper_utility', {
    utility_name: utilityName,
    utility_category: category,
    description: description || null,
    input_schema: inputSchema || {},
    output_schema: outputSchema || {},
    implementation_code: implementationCode || null
  })

  return data
}

export async function getUtilityCategories() {
  const { data } = await db
    .from('helper_utilities')
    .select('utility_category')
    .eq('is_active', true)
    
  return data?.map((item: any) => item.utility_category) || []
}
