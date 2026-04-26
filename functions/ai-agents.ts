import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { PermissionEngine, sanitizeRecordData } from './_shared/permissions'

// Type assertion to ensure we're using the instance
const permissions = PermissionEngine as any

// List AI agents
export const list = createHandler(async (ctx, _body) => {
  const { agent_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  // RLS automatically filters to accessible accounts
  let query = ctx.db
    .from('ai_agents')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (agent_type) {
    query = query.eq('agent_type', agent_type)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  const sanitized = []
  for (const agent of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, agent, 'ai_agent'))
  }

  return sanitized
})

// Get single AI agent
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Agent ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('ai_agents')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'ai_agent')
})

// Create AI agent
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, agent_type, model_config, system_prompt, tools, capabilities, constraints, metadata } = body

  if (!name || !agent_type) {
    throw new Error('name and agent_type are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('ai_agents')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      agent_type,
      model_config: model_config || {},
      system_prompt: system_prompt || null,
      tools: tools || [],
      capabilities: capabilities || [],
      constraints: constraints || {},
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'ai_agent.created', 
    { type: 'ai_agent', id: data.id }, 
    { after: { name, agent_type } }
  )

  return data
})

// Update AI agent
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Agent ID is required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const allowed = ['name', 'description', 'model_config', 'system_prompt', 'tools', 'capabilities', 'constraints', 'metadata', 'is_active']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('ai_agents')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'ai_agent.updated', 
    { type: 'ai_agent', id }, 
    { after: updateData }
  )

  return data
})

// Delete AI agent
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Agent ID is required')
  }

  const { data: current } = await ctx.db
    .from('ai_agents')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Agent not found')

  const { error: err } = await ctx.db
    .from('ai_agents')
    .delete()
    .eq('id', id)

  if (err) throw err

  await emitLog(ctx, 'ai_agent.deleted', 
    { type: 'ai_agent', id }, 
    { before: current }
  )

  return { success: true }
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    default:
      if (method === 'GET') {
        if (ctx.query?.id) {
          return await get(ctx, body)
        } else {
          return await list(ctx, body)
        }
      } else if (method === 'POST') {
        return await create(ctx, body)
      } else if (method === 'PATCH') {
        return await update(ctx, body)
      } else if (method === 'DELETE') {
        return await remove(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
