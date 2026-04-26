import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List AI agents
export const list = createHandler(async (ctx, body) => {
  const { agent_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('ai_agents')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
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

  return data
})

// Get single AI agent
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Agent ID is required')
  }

  const { data, error: err } = await db
    .from('ai_agents')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('id', id)
    .single()

  if (err) throw err

  return data
})

// Create AI agent
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, agent_type, model_config, system_prompt, tools, capabilities, constraints, metadata } = body

  if (!name || !agent_type) {
    throw new Error('name and agent_type are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_ai_agent', {
      app_id,
      name,
      description,
      agent_type,
      model_config: model_config || {},
      system_prompt,
      tools: tools || [],
      capabilities: capabilities || [],
      constraints: constraints || {},
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'ai_agent.created', 
    { type: 'ai_agent', id: data }, 
    { after: { name, agent_type } }
  )

  return { agent_id: data }
}))

// Update AI agent
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, model_config, system_prompt, tools, capabilities, constraints, metadata, is_active } = body

  if (!id) {
    throw new Error('Agent ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_ai_agent', {
      agent_id: id,
      name,
      description,
      model_config,
      system_prompt,
      tools,
      capabilities,
      constraints,
      metadata,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'ai_agent.updated', 
    { type: 'ai_agent', id }, 
    { after: { name, is_active } }
  )

  return { success: data }
}))

// Create conversation
export const createConversation = requireAuth(createHandler(async (ctx, body) => {
  const { agent_id, user_id, title, context_type, context_id, context_data, metadata } = body

  if (!agent_id) {
    throw new Error('agent_id is required')
  }

  const { data, error: err } = await db
    .rpc('create_ai_agent_conversation', {
      agent_id,
      user_id: user_id || ctx.personId,
      title,
      context_type,
      context_id,
      context_data: context_data || {},
      metadata: metadata || {}
    })

  if (err) throw err

  await emitLog(ctx, 'ai_conversation.created', 
    { type: 'ai_agent_conversation', id: data }, 
    { after: { agent_id, title } }
  )

  return { conversation_id: data }
}))

// Add message to conversation
export const addMessage = requireAuth(createHandler(async (ctx, body) => {
  const { conversation_id, role, content, tool_calls, tool_results, metadata } = body

  if (!conversation_id || !role || !content) {
    throw new Error('conversation_id, role, and content are required')
  }

  const { data, error: err } = await db
    .rpc('add_ai_agent_message', {
      conversation_id,
      role,
      content,
      tool_calls: tool_calls || [],
      tool_results: tool_results || [],
      metadata: metadata || {}
    })

  if (err) throw err

  await emitLog(ctx, 'ai_message.added', 
    { type: 'ai_agent_message', id: data }, 
    { after: { conversation_id, role } }
  )

  return { message_id: data }
}))

// Get conversation messages
export const getMessages = createHandler(async (ctx, body) => {
  const { conversation_id, limit, offset } = ctx.query || {}

  if (!conversation_id) {
    throw new Error('conversation_id is required')
  }

  const { data, error: err } = await db
    .rpc('get_ai_agent_conversation_messages', {
      conversation_id,
      limit: limit ? parseInt(limit.toString()) : 100,
      offset: offset ? parseInt(offset.toString()) : 0
    })

  if (err) throw err

  return data
})

// Search conversations
export const searchConversations = createHandler(async (ctx, body) => {
  const { agent_id, user_id, search_query, status, limit } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('search_ai_agent_conversations', {
      account_id: ctx.accountId,
      agent_id: agent_id || null,
      user_id: user_id || null,
      search_query: search_query || null,
      status: status || null,
      limit: limit ? parseInt(limit.toString()) : 50
    })

  if (err) throw err

  return data
})

// Get agent statistics
export const getStats = createHandler(async (ctx, body) => {
  const { agent_id, date_from, date_to } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_ai_agent_statistics', {
      account_id: ctx.accountId,
      agent_id: agent_id || null,
      date_from: date_from || null,
      date_to: date_to || null
    })

  if (err) throw err

  return data
})

// Get agent capabilities
export const getCapabilities = createHandler(async (ctx, body) => {
  const { agent_id } = ctx.query || {}

  if (!agent_id) {
    throw new Error('agent_id is required')
  }

  const { data, error: err } = await db
    .rpc('get_ai_agent_capabilities', { agent_id })

  if (err) throw err

  return data
})

// Create agent from template
export const createFromTemplate = requireAuth(createHandler(async (ctx, body) => {
  const { template_name, app_id, name, overrides } = body

  if (!template_name) {
    throw new Error('template_name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_ai_agent_from_template', {
      template_name,
      app_id,
      name,
      overrides: overrides || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'ai_agent.created_from_template', 
    { type: 'ai_agent', id: data }, 
    { after: { template_name, name } }
  )

  return { agent_id: data }
}))

// Cleanup old conversations
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { days_to_keep, status_filter } = body

  const { data, error: err } = await db
    .rpc('cleanup_ai_agent_conversations', {
      days_to_keep: days_to_keep || 90,
      status_filter: status_filter || null
    })

  if (err) throw err

  await emitLog(ctx, 'ai_conversations.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { days_to_keep: days_to_keep || 90, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'create-conversation':
      if (method === 'POST') {
        return await createConversation(ctx, body)
      }
      break
    case 'add-message':
      if (method === 'POST') {
        return await addMessage(ctx, body)
      }
      break
    case 'messages':
      if (method === 'GET') {
        return await getMessages(ctx, body)
      }
      break
    case 'search-conversations':
      if (method === 'GET') {
        return await searchConversations(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'capabilities':
      if (method === 'GET') {
        return await getCapabilities(ctx, body)
      }
      break
    case 'from-template':
      if (method === 'POST') {
        return await createFromTemplate(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanup(ctx, body)
      }
      break
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
      }
  }

  throw new Error('Invalid action or method')
})
