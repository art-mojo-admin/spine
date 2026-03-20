import { createHandler, requireAuth, requireTenant, json, error, parseBody, type RequestContext } from '../../core/functions/_shared/middleware'
import { db } from '../../core/functions/_shared/db'
import { emitAudit, emitActivity } from '../../core/functions/_shared/audit'

function makeCtx(accountId: string, personId: string): RequestContext {
  return { requestId: '', personId, accountId, accountNodeId: null, accountRole: null, systemRole: null, authUid: null, impersonating: false, realPersonId: null, impersonationSessionId: null }
}

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const mode = params.get('mode') || 'list'
    const itemId = params.get('item_id')
    const visibility = params.get('visibility') || 'member'

    try {
      switch (mode) {
        case 'list':
          return await listArticles(ctx.accountId!, ctx.personId!, visibility)
        case 'detail':
          if (!itemId) return error('item_id required')
          return await getArticle(ctx.accountId!, itemId, ctx.personId!)
        case 'search':
          return await searchArticles(ctx.accountId!, params)
        default:
          return error('Invalid mode')
      }
    } catch (err: any) {
      return error(err.message || 'Knowledge query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      title: string
      summary: string
      content: string
      article_kind: string
      visibility: string
      audience: string[]
      tags?: string[]
    }>(req)

    if (!body.title || !body.summary || !body.content) {
      return error('title, summary, and content required')
    }

    try {
      return await createArticle(ctx.accountId!, ctx.personId!, body)
    } catch (err: any) {
      return error(err.message || 'Article creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const itemId = params.get('item_id')
    if (!itemId) return error('item_id required')

    const body = await parseBody<{
      title?: string
      summary?: string
      content?: string
      article_kind?: string
      visibility?: string
      audience?: string[]
      tags?: string[]
      stage?: string
    }>(req)

    try {
      return await updateArticle(ctx.accountId!, ctx.personId!, itemId, body)
    } catch (err: any) {
      return error(err.message || 'Article update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const itemId = params.get('item_id')
    if (!itemId) return error('item_id required')

    try {
      return await deleteArticle(ctx.accountId!, ctx.personId!, itemId)
    } catch (err: any) {
      return error(err.message || 'Article deletion failed', 500)
    }
  },
})

async function listArticles(accountId: string, personId: string, visibility: string) {
  // Get the caller's role to enforce visibility
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'
  
  // Build visibility filter based on caller role
  let visibilityFilter = ['member']
  if (callerRole === 'operator' || callerRole === 'admin') {
    visibilityFilter = ['member', 'operator']
  }
  if (callerRole === 'admin') {
    visibilityFilter = ['member', 'operator', 'admin']
  }

  const { data, error: dbErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      status,
      stage_definition_id,
      created_at,
      updated_at,
      created_by,
      stage_definitions!inner(name),
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
    .in('status', ['active'])
    .eq('field_values.field_key', 'visibility')
    .in('field_values.value', visibilityFilter)

  if (dbErr) throw dbErr

  // Transform field values into object
  const articles = (data || []).map(item => {
    const metadata = item.metadata || {}
    const fieldValues = item.field_values || []
    
    // Extract field values
    fieldValues.forEach((fv: any) => {
      metadata[fv.field_key] = fv.value
    })

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      metadata,
      status: item.status,
      stage: (item.stage_definitions as any)?.name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      created_by: item.created_by,
    }
  })

  return json(articles)
}

async function getArticle(accountId: string, itemId: string, personId: string) {
  // Get the caller's role to enforce visibility
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'
  
  // Build visibility filter
  let visibilityFilter = ['member']
  if (callerRole === 'operator' || callerRole === 'admin') {
    visibilityFilter = ['member', 'operator']
  }
  if (callerRole === 'admin') {
    visibilityFilter = ['member', 'operator', 'admin']
  }

  const { data, error: dbErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      status,
      stage_definition_id,
      created_at,
      updated_at,
      created_by,
      stage_definitions!inner(name),
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('id', itemId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
    .eq('field_values.field_key', 'visibility')
    .in('field_values.value', visibilityFilter)
    .single()

  if (dbErr) throw dbErr
  if (!data) return error('Article not found or access denied', 404)

  // Transform field values
  const metadata = data.metadata || {}
  const fieldValues = data.field_values || []
  
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
  })

  // Get related articles
  const { data: related } = await db
    .from('item_links')
    .select(`
      target_item_id,
      items!inner(title, description, metadata)
    `)
    .eq('source_item_id', itemId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'related_to').single()).data?.id)

  // Get support cases that reference this article
  const { data: supportCases } = await db
    .from('item_links')
    .select(`
      source_item_id,
      items!inner(title, metadata, stage_definitions!inner(name))
    `)
    .eq('target_item_id', itemId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'references').single()).data?.id)

  const article = {
    id: data.id,
    title: data.title,
    description: data.description,
    metadata,
    status: data.status,
    stage: (data.stage_definitions as any)?.name,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    related_articles: related || [],
    referenced_by_cases: supportCases || [],
  }

  return json(article)
}

async function searchArticles(accountId: string, params: URLSearchParams) {
  const query = params.get('q')
  const articleKind = params.get('article_kind')
  const audience = params.get('audience')
  const tags = params.get('tags')?.split(',').map(t => t.trim())

  if (!query) return error('Search query required')

  // Get the caller's role to enforce visibility
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', db.raw('CURRENT_USER'))
    .single()

  const callerRole = caller?.account_role || 'member'
  
  // Build visibility filter
  let visibilityFilter = ['member']
  if (callerRole === 'operator' || callerRole === 'admin') {
    visibilityFilter = ['member', 'operator']
  }
  if (callerRole === 'admin') {
    visibilityFilter = ['member', 'operator', 'admin']
  }

  let queryBuilder = db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      status,
      stage_definition_id,
      created_at,
      updated_at,
      stage_definitions!inner(name),
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
    .eq('field_values.field_key', 'visibility')
    .in('field_values.value', visibilityFilter)

  // Apply filters
  if (query) {
    queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
  }

  const { data, error: dbErr } = await queryBuilder

  if (dbErr) throw dbErr

  // Transform and filter results
  const articles = (data || []).map(item => {
    const metadata = item.metadata || {}
    const fieldValues = item.field_values || []
    
    fieldValues.forEach((fv: any) => {
      metadata[fv.field_key] = fv.value
    })

    // Apply additional filters
    if (articleKind && metadata.article_kind !== articleKind) return null
    if (audience && !metadata.audience?.includes(audience)) return null
    if (tags && tags.length > 0) {
      const articleTags = metadata.tags || []
      if (!tags.some(tag => articleTags.includes(tag))) return null
    }

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      metadata,
      status: item.status,
      stage: (item.stage_definitions as any)?.name,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }
  }).filter(Boolean)

  return json(articles)
}

async function createArticle(accountId: string, personId: string, body: any) {
  // Get item type and initial stage
  const { data: itemType } = await db
    .from('item_type_registry')
    .select('id')
    .eq('slug', 'knowledge_article')
    .single()

  const { data: draftStage } = await db
    .from('stage_definitions')
    .select('id')
    .eq('name', 'Draft')
    .eq('workflow_definition_id', (await db.from('workflow_definitions').select('id').eq('name', 'Knowledge Lifecycle').eq('account_id', accountId).single()).data?.id)
    .single()

  const { data, error: dbErr } = await db
    .from('items')
    .insert({
      account_id: accountId,
      item_type_id: itemType?.id,
      workflow_definition_id: (await db.from('workflow_definitions').select('id').eq('name', 'Knowledge Lifecycle').eq('account_id', accountId).single()).data?.id,
      stage_definition_id: draftStage?.id,
      title: body.title,
      description: body.summary,
      metadata: {
        article_kind: body.article_kind,
        visibility: body.visibility,
        audience: body.audience,
        tags: body.tags || [],
        content: body.content,
      },
      status: 'active',
      created_by: personId,
      ownership: 'tenant',
    })
    .select()
    .single()

  if (dbErr) throw dbErr

  // Create field values
  const fieldValues = [
    { field_key: 'article_kind', value: body.article_kind },
    { field_key: 'visibility', value: body.visibility },
    { field_key: 'audience', value: body.audience },
    { field_key: 'tags', value: body.tags || [] },
    { field_key: 'summary', value: body.summary },
    { field_key: 'content', value: body.content },
  ]

  for (const fv of fieldValues) {
    await db.from('field_values').insert({
      account_id: accountId,
      item_id: data.id,
      field_key: fv.field_key,
      value: fv.value,
      created_by: personId,
    })
  }

  await emitAudit(makeCtx(accountId, personId), 'create', 'item', data.id, null, data)
  await emitActivity(makeCtx(accountId, personId), 'knowledge.created', `Created knowledge article: ${body.title}`, 'item', data.id)

  return json(data, 201)
}

async function updateArticle(accountId: string, personId: string, itemId: string, body: any) {
  // Get current article
  const { data: current, error: fetchErr } = await db
    .from('items')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', itemId)
    .single()

  if (fetchErr) throw fetchErr
  if (!current) return error('Article not found', 404)

  // Prepare update data
  const updateData: any = {}
  const metadata = { ...current.metadata }

  if (body.title) updateData.title = body.title
  if (body.summary) {
    updateData.description = body.summary
    metadata.summary = body.summary
  }
  if (body.content) metadata.content = body.content
  if (body.article_kind) metadata.article_kind = body.article_kind
  if (body.visibility) metadata.visibility = body.visibility
  if (body.audience) metadata.audience = body.audience
  if (body.tags) metadata.tags = body.tags

  updateData.metadata = metadata
  updateData.updated_at = new Date().toISOString()

  // Handle stage transitions
  if (body.stage) {
    const { data: newStage } = await db
      .from('stage_definitions')
      .select('id')
      .eq('name', body.stage)
      .eq('workflow_definition_id', current.workflow_definition_id)
      .single()

    if (newStage) {
      updateData.stage_definition_id = newStage.id
    }
  }

  const { data, error: dbErr } = await db
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single()

  if (dbErr) throw dbErr

  // Update field values
  for (const [key, value] of Object.entries(body)) {
    if (key !== 'stage' && value !== undefined) {
      await db.from('field_values')
        .upsert({
          account_id: accountId,
          item_id: itemId,
          field_key: key,
          value,
          updated_by: personId,
        })
        .eq('item_id', itemId)
        .eq('field_key', key)
    }
  }

  await emitAudit(makeCtx(accountId, personId), 'update', 'item', itemId, current, data)
  await emitActivity(makeCtx(accountId, personId), 'knowledge.updated', `Updated knowledge article: ${data.title}`, 'item', itemId)

  return json(data)
}

async function deleteArticle(accountId: string, personId: string, itemId: string) {
  const { data: current, error: fetchErr } = await db
    .from('items')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', itemId)
    .single()

  if (fetchErr) throw fetchErr
  if (!current) return error('Article not found', 404)

  const { error: dbErr } = await db
    .from('items')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', itemId)

  if (dbErr) throw dbErr

  await emitAudit(makeCtx(accountId, personId), 'delete', 'item', itemId, current, null)
  await emitActivity(makeCtx(accountId, personId), 'knowledge.deleted', `Deleted knowledge article: ${current.title}`, 'item', itemId)

  return json({ success: true })
}
