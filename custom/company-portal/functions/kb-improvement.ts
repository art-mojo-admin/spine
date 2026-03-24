import { createHandler, requireAuth, requireTenant, json, error, parseBody, type RequestContext } from '../../core/functions/_shared/middleware'
import { db } from '../../core/functions/_shared/db'
import { emitAudit, emitActivity } from '../../core/functions/_shared/audit'
import { ItemsDAL, type ItemTypeSchema } from '../../core/functions/_shared/items-dal'

function makeCtx(accountId: string, personId: string): RequestContext {
  return { requestId: '', personId, accountId, accountNodeId: null, accountRole: null, principalScopes: [], systemRole: null, authUid: null, impersonating: false, realPersonId: null, impersonationSessionId: null }
}

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      case_id: string
      action: 'create_draft' | 'update_existing'
      target_article_id?: string
      title?: string
      content?: string
      summary?: string
      article_kind?: string
      tags?: string[]
      audience?: string[]
    }>(req)

    if (!body.case_id || !body.action) {
      return error('case_id and action required')
    }

    if (body.action === 'update_existing' && !body.target_article_id) {
      return error('target_article_id required for update_existing action')
    }

    try {
      return await processKBImprovement(ctx.accountId!, ctx.personId!, body)
    } catch (err: any) {
      return error(err.message || 'KB improvement processing failed', 500)
    }
  },

  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const caseId = params.get('case_id')
    if (!caseId) return error('case_id required')

    try {
      return await getKBImprovementSuggestions(ctx.accountId!, caseId)
    } catch (err: any) {
      return error(err.message || 'Failed to get KB improvement suggestions', 500)
    }
  },
})

async function processKBImprovement(accountId: string, personId: string, body: any) {
  // Get the support case
  const { data: supportCase, error: caseErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      stage_definition_id,
      created_at,
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('id', body.case_id)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'support_case').single()).data?.id)
    .single()

  if (caseErr) throw caseErr
  if (!supportCase) return error('Support case not found', 404)

  // Check permissions (operators and admins only)
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'
  if (callerRole === 'member') {
    return error('Access denied', 403)
  }

  // Extract case metadata
  const metadata = { ...supportCase.metadata }
  const fieldValues = supportCase.field_values || []
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
  })

  // Check if case is resolved
  const { data: currentStage } = await db
    .from('stage_definitions')
    .select('name')
    .eq('id', supportCase.stage_definition_id)
    .single()

  if (currentStage?.name !== 'Resolved') {
    return error('Case must be resolved before creating KB content', 400)
  }

  let result

  if (body.action === 'create_draft') {
    result = await createKnowledgeDraft(accountId, personId, supportCase, metadata, body)
  } else if (body.action === 'update_existing') {
    result = await updateExistingArticle(accountId, personId, supportCase, metadata, body)
  } else {
    return error('Invalid action', 400)
  }

  return json(result)
}

async function createKnowledgeDraft(accountId: string, personId: string, supportCase: any, caseMetadata: any, body: any) {
  // Get user's role for permission checking
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'

  // Get item type schema for validation
  const schema = await ItemsDAL.getItemTypeSchema('knowledge_article')
  if (!schema) {
    return error('Knowledge article item type not found', 404)
  }

  // Check create permissions
  const canCreate = ItemsDAL.evaluateRecordAccess(schema, callerRole, 'create')
  if (!canCreate) {
    return error('Insufficient permissions to create knowledge articles', 403)
  }

  // Get knowledge article item type and draft stage
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

  // Generate title and content if not provided
  const title = body.title || generateTitleFromCase(supportCase, caseMetadata)
  const content = body.content || generateContentFromCase(supportCase, caseMetadata)
  const summary = body.summary || generateSummaryFromCase(supportCase, caseMetadata)
  const articleKind = body.article_kind || determineArticleKind(caseMetadata)
  const tags = body.tags || extractTagsFromCase(supportCase, caseMetadata)
  const audience = body.audience || determineAudience(caseMetadata)

  // Validate and sanitize input data
  const articleData = {
    title,
    description: summary,
    article_kind: articleKind,
    visibility: 'member',
    audience,
    tags,
    content,
    summary,
  }

  const validatedData = ItemsDAL.validateUpdateData(articleData, {}, schema, callerRole)
  if (!validatedData) {
    return error('Invalid article data provided', 400)
  }

  // Sanitize metadata according to schema
  const sanitizedMetadata = ItemsDAL.sanitizeItemData({
    article_kind: validatedData.article_kind,
    visibility: validatedData.visibility,
    audience: validatedData.audience,
    tags: validatedData.tags,
    content: validatedData.content,
    source_case_id: supportCase.id,
    source_case_title: supportCase.title,
    created_from_case: true,
  }, schema, callerRole)

  // Create the knowledge article
  const { data: article, error: createErr } = await db
    .from('items')
    .insert({
      account_id: accountId,
      item_type_id: itemType?.id,
      workflow_definition_id: (await db.from('workflow_definitions').select('id').eq('name', 'Knowledge Lifecycle').eq('account_id', accountId).single()).data?.id,
      stage_definition_id: draftStage?.id,
      title: validatedData.title,
      description: validatedData.summary,
      metadata: sanitizedMetadata,
      status: 'active',
      created_by: personId,
    })
    .select()
    .single()

  if (createErr) throw createErr

  // Create field values with schema validation
  const fieldValues = [
    { field_key: 'article_kind', value: validatedData.article_kind },
    { field_key: 'visibility', value: validatedData.visibility },
    { field_key: 'audience', value: validatedData.audience },
    { field_key: 'tags', value: validatedData.tags },
    { field_key: 'summary', value: validatedData.summary },
    { field_key: 'content', value: validatedData.content },
  ]

  // Validate each field value against schema
  for (const fv of fieldValues) {
    if (schema.fields && schema.fields[fv.field_key]) {
      const fieldSchema = schema.fields[fv.field_key]
      const fieldAccess = ItemsDAL.evaluateFieldAccess(fieldSchema, callerRole, 'all', 'update')
      if (fieldAccess === 'none') {
        continue // Skip fields user can't update
      }
    }

    await db.from('field_values').insert({
      account_id: accountId,
      item_id: article.id,
      field_key: fv.field_key,
      value: fv.value,
      created_by: personId,
    })
  }

  // Create link from case to new article
  await db
    .from('item_links')
    .insert({
      account_id: accountId,
      source_item_id: supportCase.id,
      target_item_id: article.id,
      link_type_id: (await db.from('link_type_registry').select('id').eq('slug', 'resulted_in').single()).data?.id,
      created_by: personId,
    })

  // Update case resolution metadata
  await db
    .from('field_values')
    .upsert({
      account_id: accountId,
      item_id: supportCase.id,
      field_key: 'resolution_kind',
      value: 'knowledge_created',
      updated_by: personId,
    })
    .eq('item_id', supportCase.id)
    .eq('field_key', 'resolution_kind')

  // Audit and activity
  await emitAudit(makeCtx(accountId, personId), 'create', 'item', article.id, null, article)
  await emitActivity(makeCtx(accountId, personId), 'knowledge.draft_created', `Created knowledge draft from case: ${title}`, 'item', article.id)
  await emitActivity(makeCtx(accountId, personId), 'support.resolution_linked', `Linked case resolution to new knowledge article`, 'item', supportCase.id)

  return {
    action: 'draft_created',
    article_id: article.id,
    article_title: title,
    article_stage: 'Draft',
    message: 'Knowledge draft created successfully. Please review and publish.'
  }
}

async function updateExistingArticle(accountId: string, personId: string, supportCase: any, caseMetadata: any, body: any) {
  // Get the existing article
  const { data: article, error: fetchErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      stage_definition_id,
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('id', body.target_article_id)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
    .single()

  if (fetchErr) throw fetchErr
  if (!article) return error('Target article not found', 404)

  // Prepare update content
  let updatedContent = article.metadata?.content || ''
  let updatedSummary = article.description || ''
  let updatedTags = []

  // Extract field values
  const metadata = { ...article.metadata }
  const fieldValues = article.field_values || []
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
    if (fv.field_key === 'tags') updatedTags = fv.value
  })

  // Generate updates
  if (body.content) {
    updatedContent = appendToContent(updatedContent, body.content, supportCase.title)
  } else {
    const generatedContent = generateContentFromCase(supportCase, caseMetadata)
    updatedContent = appendToContent(updatedContent, generatedContent, supportCase.title)
  }

  if (body.summary) {
    updatedSummary = body.summary
  } else {
    const generatedSummary = generateSummaryFromCase(supportCase, caseMetadata)
    updatedSummary = `${updatedSummary}\n\nUpdated based on case: ${supportCase.title}`
  }

  // Merge tags
  const caseTags = extractTagsFromCase(supportCase, caseMetadata)
  updatedTags = [...new Set([...updatedTags, ...caseTags])]

  // Update the article
  const { data: updatedArticle, error: updateErr } = await db
    .from('items')
    .update({
      description: updatedSummary,
      metadata: {
        ...metadata,
        content: updatedContent,
        tags: updatedTags,
        last_updated_from_case: supportCase.id,
        last_updated_from_case_title: supportCase.title,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.target_article_id)
    .select()
    .single()

  if (updateErr) throw updateErr

  // Update field values
  await db.from('field_values')
    .upsert({
      account_id: accountId,
      item_id: body.target_article_id,
      field_key: 'summary',
      value: updatedSummary,
      updated_by: personId,
    })
    .eq('item_id', body.target_article_id)
    .eq('field_key', 'summary')

  await db.from('field_values')
    .upsert({
      account_id: accountId,
      item_id: body.target_article_id,
      field_key: 'content',
      value: updatedContent,
      updated_by: personId,
    })
    .eq('item_id', body.target_article_id)
    .eq('field_key', 'content')

  await db.from('field_values')
    .upsert({
      account_id: accountId,
      item_id: body.target_article_id,
      field_key: 'tags',
      value: updatedTags,
      updated_by: personId,
    })
    .eq('item_id', body.target_article_id)
    .eq('field_key', 'tags')

  // Create link from case to article
  await db
    .from('item_links')
    .insert({
      account_id: accountId,
      source_item_id: supportCase.id,
      target_item_id: body.target_article_id,
      link_type_id: (await db.from('link_type_registry').select('id').eq('slug', 'resulted_in').single()).data?.id,
      created_by: personId,
    })

  // Update case resolution metadata
  await db
    .from('field_values')
    .upsert({
      account_id: accountId,
      item_id: supportCase.id,
      field_key: 'resolution_kind',
      value: 'knowledge_updated',
      updated_by: personId,
    })
    .eq('item_id', supportCase.id)
    .eq('field_key', 'resolution_kind')

  // Audit and activity
  await emitAudit(makeCtx(accountId, personId), 'update', 'item', body.target_article_id, article, updatedArticle)
  await emitActivity(makeCtx(accountId, personId), 'knowledge.updated_from_case', `Updated article from case: ${supportCase.title}`, 'item', body.target_article_id)
  await emitActivity(makeCtx(accountId, personId), 'support.resolution_linked', `Linked case resolution to updated knowledge article`, 'item', supportCase.id)

  return {
    action: 'article_updated',
    article_id: body.target_article_id,
    article_title: article.title,
    message: 'Article updated successfully with case resolution details.'
  }
}

async function getKBImprovementSuggestions(accountId: string, caseId: string) {
  // Get the support case
  const { data: supportCase, error: caseErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      stage_definition_id,
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('id', caseId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'support_case').single()).data?.id)
    .single()

  if (caseErr) throw caseErr
  if (!supportCase) return error('Support case not found', 404)

  // Extract metadata
  const metadata = { ...supportCase.metadata }
  const fieldValues = supportCase.field_values || []
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
  })

  // Check if case is resolved
  const { data: currentStage } = await db
    .from('stage_definitions')
    .select('name')
    .eq('id', supportCase.stage_definition_id)
    .single()

  const isResolved = currentStage?.name === 'Resolved'

  // Search for related existing articles
  const relatedArticles = await searchRelatedArticles(accountId, supportCase.title + ' ' + supportCase.description)

  // Generate suggestions
  const suggestions = {
    can_create_draft: isResolved,
    can_update_existing: isResolved && relatedArticles.length > 0,
    suggested_title: generateTitleFromCase(supportCase, metadata),
    suggested_summary: generateSummaryFromCase(supportCase, metadata),
    suggested_content: generateContentFromCase(supportCase, metadata),
    suggested_article_kind: determineArticleKind(metadata),
    suggested_tags: extractTagsFromCase(supportCase, metadata),
    suggested_audience: determineAudience(metadata),
    related_articles: relatedArticles.map((article: any) => ({
      id: article.id,
      title: article.title,
      summary: article.description,
      relevance_score: article.score || 0
    })),
    case_resolution: {
      is_resolved: isResolved,
      current_stage: currentStage?.name,
      escalation_reason: metadata.escalation_reason,
      ai_confidence_score: metadata.ai_confidence_score
    }
  }

  return json(suggestions)
}

// Helper functions

function generateTitleFromCase(supportCase: any, metadata: any): string {
  // Generate a knowledge article title from the case
  const baseTitle = supportCase.title
  
  // Common patterns
  if (metadata.escalation_reason === 'missing_knowledge') {
    return `How to ${baseTitle.replace(/How do I|How to/gi, '').trim()}`
  }
  
  if (metadata.escalation_reason === 'product_issue') {
    return `Troubleshooting: ${baseTitle}`
  }
  
  if (baseTitle.toLowerCase().includes('error') || baseTitle.toLowerCase().includes('issue')) {
    return `Fixing ${baseTitle}`
  }
  
  return baseTitle
}

function generateSummaryFromCase(supportCase: any, metadata: any): string {
  // Generate a summary from case description and resolution
  let summary = supportCase.description
  
  if (metadata.resolution_notes) {
    summary += `\n\nResolution: ${metadata.resolution_notes}`
  }
  
  if (metadata.ai_summary) {
    summary += `\n\nAI Analysis: ${metadata.ai_summary}`
  }
  
  return summary
}

function generateContentFromCase(supportCase: any, metadata: any): string {
  // Generate structured content from case details
  let content = `## Problem\n\n${supportCase.description}\n\n`
  
  if (metadata.escalation_reason) {
    content += `## Issue Type\n\n${metadata.escalation_reason.replace(/_/g, ' ')}\n\n`
  }
  
  if (metadata.priority) {
    content += `## Priority\n\n${metadata.priority}\n\n`
  }
  
  content += `## Solution\n\n`
  
  if (metadata.resolution_notes) {
    content += `${metadata.resolution_notes}\n\n`
  } else {
    content += `This issue was resolved by the support team. The specific solution details should be documented here.\n\n`
  }
  
  content += `## Additional Notes\n\n`
  content += `- Case ID: ${supportCase.id}\n`
  content += `- Original Title: ${supportCase.title}\n`
  content += `- Created: ${new Date(supportCase.created_at).toLocaleDateString()}\n`
  
  return content
}

function determineArticleKind(metadata: any): string {
  // Determine article kind based on case metadata
  if (metadata.escalation_reason === 'product_issue') {
    return 'troubleshooting'
  }
  
  if (metadata.priority === 'urgent' || metadata.priority === 'high') {
    return 'implementation'
  }
  
  return 'faq'
}

function extractTagsFromCase(supportCase: any, metadata: any): string[] {
  // Extract tags from case metadata and content
  const tags = []
  
  // Add tags from case metadata
  if (metadata.tags && Array.isArray(metadata.tags)) {
    tags.push(...metadata.tags)
  }
  
  // Add tags based on escalation reason
  if (metadata.escalation_reason) {
    tags.push(metadata.escalation_reason.replace(/_/g, '-'))
  }
  
  // Add tags based on priority
  if (metadata.priority) {
    tags.push(metadata.priority)
  }
  
  // Extract potential tags from title and description
  const text = `${supportCase.title} ${supportCase.description}`.toLowerCase()
  
  const commonTags = ['api', 'ui', 'security', 'performance', 'authentication', 'database', 'integration', 'error', 'bug']
  commonTags.forEach(tag => {
    if (text.includes(tag) && !tags.includes(tag)) {
      tags.push(tag)
    }
  })
  
  return [...new Set(tags)]
}

function determineAudience(metadata: any): string[] {
  // Determine audience based on case details
  const audience = ['customer'] // Default
  
  if (metadata.priority === 'urgent' || metadata.escalation_reason === 'product_issue') {
    audience.push('operator')
  }
  
  if (metadata.title?.toLowerCase().includes('api') || metadata.title?.toLowerCase().includes('integration')) {
    audience.push('developer')
  }
  
  return [...new Set(audience)]
}

function appendToContent(existingContent: string, newContent: string, caseTitle: string): string {
  // Append new content to existing article
  const timestamp = new Date().toISOString()
  const separator = `\n\n---\n\n## Updated from Support Case: ${caseTitle}\n_Updated: ${new Date(timestamp).toLocaleDateString()}_\n\n`
  
  return existingContent + separator + newContent
}

async function searchRelatedArticles(accountId: string, query: string) {
  // Search for related knowledge articles
  const searchUrl = `${process.env.API_URL}/semantic-search`
  const searchParams = new URLSearchParams({
    query,
    mode: 'semantic',
    entity_types: 'item',
    limit: '3',
    threshold: '0.6'
  })

  try {
    const response = await fetch(`${searchUrl}?${searchParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      return []
    }

    const searchResults = await response.json()
    const relatedArticles = []

    for (const result of searchResults.results || []) {
      if (result.entity_type !== 'item') continue

      const { data: item } = await db
        .from('items')
        .select(`
          id,
          title,
          description,
          metadata
        `)
        .eq('account_id', accountId)
        .eq('id', result.entity_id)
        .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
        .single()

      if (item) {
        relatedArticles.push({
          id: item.id,
          title: item.title,
          description: item.description,
          score: result.score || 0
        })
      }
    }

    return relatedArticles
  } catch (err) {
    console.error('Error searching related articles:', err)
    return []
  }
}
