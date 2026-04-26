import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List prompt configs
export const list = createHandler(async (ctx, body) => {
  const { prompt_type, category, is_active, is_default, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('prompt_configs')
    .select(`
      *,
      app:apps(id, slug, name),
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('name')

  if (prompt_type) {
    query = query.eq('prompt_type', prompt_type)
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }
  if (is_default !== undefined) {
    query = query.eq('is_default', is_default === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  return data
})

// Get single prompt config
export const get = createHandler(async (ctx, body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Config ID is required')
  }

  const { data, error: err } = await db
    .from('prompt_configs')
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

// Create prompt config
export const create = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, name, description, prompt_type, category, template, variables, model_config, constraints, examples, is_default, metadata } = body

  if (!name || !prompt_type || !template) {
    throw new Error('name, prompt_type, and template are required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('create_prompt_config', {
      app_id,
      name,
      description,
      prompt_type,
      category: category || 'general',
      template,
      variables: variables || [],
      model_config: model_config || {},
      constraints: constraints || {},
      examples: examples || [],
      is_default: is_default || false,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'prompt_config.created', 
    { type: 'prompt_config', id: data }, 
    { after: { name, prompt_type } }
  )

  return { config_id: data }
}))

// Update prompt config
export const update = requireAuth(createHandler(async (ctx, body) => {
  const { id, name, description, category, template, variables, model_config, constraints, examples, metadata, is_active } = body

  if (!id) {
    throw new Error('Config ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_prompt_config', {
      config_id: id,
      name,
      description,
      category,
      template,
      variables,
      model_config,
      constraints,
      examples,
      metadata,
      is_active
    })

  if (err) throw err

  await emitLog(ctx, 'prompt_config.updated', 
    { type: 'prompt_config', id }, 
    { after: { name, is_active } }
  )

  return { success: data }
}))

// Render prompt template
export const render = createHandler(async (ctx, body) => {
  const { config_id, variables_data } = body

  if (!config_id) {
    throw new Error('config_id is required')
  }

  const { data, error: err } = await db
    .rpc('render_prompt_template', {
      config_id,
      variables_data: variables_data || {}
    })

  if (err) throw err

  return data
})

// Get prompt configs by type
export const getByType = createHandler(async (ctx, body) => {
  const { prompt_type, category, app_id, include_inactive } = ctx.query || {}

  if (!prompt_type) {
    throw new Error('prompt_type is required')
  }

  const { data, error: err } = await db
    .rpc('get_prompt_configs_by_type', {
      prompt_type,
      category: category || null,
      app_id: app_id || null,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// Get default prompt config
export const getDefault = createHandler(async (ctx, body) => {
  const { prompt_type, category, app_id } = ctx.query || {}

  if (!prompt_type) {
    throw new Error('prompt_type is required')
  }

  const { data, error: err } = await db
    .rpc('get_default_prompt_config', {
      prompt_type,
      category: category || null,
      app_id: app_id || null
    })

  if (err) throw err

  return data
})

// Validate prompt template
export const validate = createHandler(async (ctx, body) => {
  const { config_id } = ctx.query || {}

  if (!config_id) {
    throw new Error('config_id is required')
  }

  const { data, error: err } = await db
    .rpc('validate_prompt_template', { config_id })

  if (err) throw err

  return data
})

// Get prompt config statistics
export const getStats = createHandler(async (ctx, body) => {
  const { app_id } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_prompt_config_statistics', {
      account_id: ctx.accountId,
      app_id: app_id || null
    })

  if (err) throw err

  return data
})

// Get prompt config versions
export const getVersions = createHandler(async (ctx, body) => {
  const { config_id, limit } = ctx.query || {}

  if (!config_id) {
    throw new Error('config_id is required')
  }

  const { data, error: err } = await db
    .rpc('get_prompt_config_versions', {
      config_id,
      limit: limit ? parseInt(limit.toString()) : 10
    })

  if (err) throw err

  return data
})

// Create prompt config from template
export const createFromTemplate = requireAuth(createHandler(async (ctx, body) => {
  const { template_name, app_id, name, overrides } = body

  if (!template_name) {
    throw new Error('template_name is required')
  }

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('v2_create_prompt_config_from_template', {
      template_name,
      app_id,
      name,
      overrides: overrides || {},
      created_by: ctx.personId,
      account_id: ctx.accountId
    })

  if (err) throw err

  await emitLog(ctx, 'prompt_config.created_from_template', 
    { type: 'prompt_config', id: data }, 
    { after: { template_name, name } }
  )

  return { config_id: data }
}))

// Cleanup old versions
export const cleanup = requireAuth(createHandler(async (ctx, body) => {
  const { keep_versions } = body

  const { data, error: err } = await db
    .rpc('cleanup_prompt_config_versions', {
      keep_versions: keep_versions || 10
    })

  if (err) throw err

  await emitLog(ctx, 'prompt_config_versions.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { keep_versions: keep_versions || 10, deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'render':
      if (method === 'POST') {
        return await render(ctx, body)
      }
      break
    case 'by-type':
      if (method === 'GET') {
        return await getByType(ctx, body)
      }
      break
    case 'default':
      if (method === 'GET') {
        return await getDefault(ctx, body)
      }
      break
    case 'validate':
      if (method === 'GET') {
        return await validate(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'versions':
      if (method === 'GET') {
        return await getVersions(ctx, body)
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
