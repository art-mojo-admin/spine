import { createHandler } from './_shared/middleware'
import { joins } from './_shared/db'
import { emitLog } from './_shared/audit'
import { sanitizeRecordData } from './_shared/permissions'

// List integrations
export const list = createHandler(async (ctx, _body) => {
  const { integration_type, provider, is_active, is_configured, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = ctx.db
    .from('integrations')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .order('name')

  if (integration_type) {
    query = query.eq('integration_type', integration_type)
  }
  if (provider) {
    query = query.eq('provider', provider)
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true')
  }
  if (is_configured !== undefined) {
    query = query.eq('is_configured', is_configured === 'true')
  }

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err

  const sanitized = []
  for (const integration of data || []) {
    sanitized.push(await sanitizeRecordData(ctx, integration, 'integration'))
  }

  return sanitized
})

// Get single integration
export const get = createHandler(async (ctx, _body) => {
  const { id } = ctx.query || {}

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data, error: err } = await ctx.db
    .from('integrations')
    .select(`*, ${joins.app}, ${joins.createdBy}`)
    .eq('id', id)
    .single()

  if (err) throw err

  return await sanitizeRecordData(ctx, data, 'integration')
})

// Create integration
export const create = createHandler(async (ctx, body) => {
  const { app_id, name, description, integration_type, provider, version, config, credentials, metadata } = body

  if (!name || !integration_type || !provider) {
    throw new Error('name, integration_type, and provider are required')
  }

  if (!ctx.principal || ctx.principal.id === 'anonymous' || !ctx.accountId) {
    throw new Error('User context (person and account) required')
  }

  const { data, error: err } = await ctx.db
    .from('integrations')
    .insert({
      app_id: app_id || null,
      account_id: ctx.accountId,
      name,
      description: description || null,
      integration_type,
      provider,
      version: version || '1.0.0',
      config: config || {},
      credentials: credentials || {},
      metadata: metadata || {},
      created_by: ctx.principal.id
    })
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'integration.created', 
    { type: 'integration', id: data.id }, 
    { after: { name, integration_type, provider } }
  )

  return data
})

// Update integration
export const update = createHandler(async (ctx, body) => {
  const id = body?.id || ctx.query?.id
  const { id: _bodyId, ...updates } = body || {}

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const allowed = ['name', 'description', 'integration_type', 'provider', 'version', 'config', 'credentials', 'metadata', 'is_active', 'is_configured']
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key]
  }

  const { data, error: err } = await ctx.db
    .from('integrations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'integration.updated', 
    { type: 'integration', id }, 
    { after: updateData }
  )

  return data
})

// Delete integration (soft delete — deactivate)
export const remove = createHandler(async (ctx, _body) => {
  const id = ctx.query?.id

  if (!id) {
    throw new Error('Integration ID is required')
  }

  const { data: current } = await ctx.db
    .from('integrations')
    .select('id, name, provider')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Integration not found')

  const { data, error: err } = await ctx.db
    .from('integrations')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'integration.deleted',
    { type: 'integration', id },
    { before: current, after: { is_active: false } }
  )

  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      if (ctx.query?.id) {
        return await get(ctx, body)
      } else {
        return await list(ctx, body)
      }
    case 'POST':
      return await create(ctx, body)
    case 'PATCH':
      return await update(ctx, body)
    case 'DELETE':
      return await remove(ctx, body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
