import { createHandler, requireAuth, requireTenant, json, error, parseBody, type RequestContext } from '../../core/functions/_shared/middleware'
import { db } from '../../core/functions/_shared/db'
import { emitAudit, emitActivity } from '../../core/functions/_shared/audit'

function makeCtx(accountId: string, personId: string): RequestContext {
  return { requestId: '', personId, accountId, accountNodeId: null, accountRole: null, systemRole: null, authUid: null, impersonating: false, realPersonId: null, impersonationSessionId: null }
}
import { callAI } from '../../core/functions/_shared/workflow-engine'

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      case_id: string
      user_message: string
      context?: Record<string, any>
    }>(req)

    if (!body.case_id || !body.user_message) {
      return error('case_id and user_message required')
    }

    try {
      return await processAISupport(ctx.accountId!, ctx.personId!, body)
    } catch (err: any) {
      return error(err.message || 'AI support processing failed', 500)
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
      return await getAISupportHistory(ctx.accountId!, caseId)
    } catch (err: any) {
      return error(err.message || 'Failed to get AI support history', 500)
    }
  },
})

async function processAISupport(accountId: string, personId: string, body: any) {
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
  const sc = supportCase as any

  // Check if user owns this case
  if (sc.created_by !== personId) {
    return error('Access denied', 403)
  }

  // Extract field values
  const metadata = { ...sc.metadata }
  const fieldValues = sc.field_values || []
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
  })

  // STEP 1: Search knowledge base for relevant articles
  const searchResults = await searchKnowledge(accountId, body.user_message, metadata.priority)

  // STEP 2: Build AI prompt with search results
  const systemPrompt = `You are a helpful AI support assistant for Spine. 

Your task is to answer user questions based on the provided knowledge base articles.

Rules:
1. Answer ONLY using information from the provided knowledge articles
2. If the articles don't contain the answer, say you don't have enough information
3. Provide clear, actionable answers
4. If multiple articles are relevant, synthesize the information
5. Always cite which articles you used

Knowledge Articles:
${searchResults.map((article: any) => `
### ${article.title}
${article.summary}
${article.content}
`).join('\n')}

User Question: ${body.user_message}

Provide a helpful response based on the knowledge above.`

  // STEP 3: Call AI
  const aiResponse = await callAI(systemPrompt, body.user_message, 'gpt-4o-mini')

  if (!aiResponse) {
    throw new Error('AI service unavailable')
  }

  // STEP 4: Analyze AI response and determine confidence
  const confidenceScore = calculateConfidence(aiResponse, searchResults)
  const shouldEscalate = confidenceScore < 0.7

  // STEP 5: Update support case with AI results
  const escalationReason = shouldEscalate ? determineEscalationReason(aiResponse, searchResults) : null
  const updateData: Record<string, any> = {
    ai_confidence_score: confidenceScore,
    ai_summary: aiResponse.substring(0, 500), // Truncate for storage
    stage: shouldEscalate ? 'Escalated' : 'Open',
    ...(escalationReason ? { escalation_reason: escalationReason } : {})
  }

  // Update the case
  await db
    .from('items')
    .update({
      stage_definition_id: (await db.from('stage_definitions').select('id').eq('name', shouldEscalate ? 'Escalated' : 'Open').eq('workflow_definition_id', sc.workflow_definition_id).single()).data?.id,
      metadata: { ...metadata, ...updateData },
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.case_id)

  // Update field values
  await db.from('field_values')
    .upsert({
      account_id: accountId,
      item_id: body.case_id,
      field_key: 'ai_confidence_score',
      value: confidenceScore,
      updated_by: personId,
    })
    .eq('item_id', body.case_id)
    .eq('field_key', 'ai_confidence_score')

  await db.from('field_values')
    .upsert({
      account_id: accountId,
      item_id: body.case_id,
      field_key: 'ai_summary',
      value: aiResponse.substring(0, 500),
      updated_by: personId,
    })
    .eq('item_id', body.case_id)
    .eq('field_key', 'ai_summary')

  if (escalationReason) {
    await db.from('field_values')
      .upsert({
        account_id: accountId,
        item_id: body.case_id,
        field_key: 'escalation_reason',
        value: escalationReason,
        updated_by: personId,
      })
      .eq('item_id', body.case_id)
      .eq('field_key', 'escalation_reason')
  }

  // STEP 6: Add AI response to case thread
  const { data: thread } = await db
    .from('threads')
    .select('id')
    .eq('target_type', 'item')
    .eq('target_id', body.case_id)
    .eq('account_id', accountId)
    .single()

  if (thread) {
    // Add user message
    await db
      .from('messages')
      .insert({
        account_id: accountId,
        thread_id: thread.id,
        content: body.user_message,
        direction: 'inbound',
        sequence: (await db.from('messages').select('sequence').eq('thread_id', thread.id).order('sequence', { ascending: false }).limit(1).single()).data?.sequence + 1 || 1,
        created_by: personId,
      })

    // Add AI response
    await db
      .from('messages')
      .insert({
        account_id: accountId,
        thread_id: thread.id,
        content: aiResponse,
        direction: 'outbound',
        sequence: (await db.from('messages').select('sequence').eq('thread_id', thread.id).order('sequence', { ascending: false }).limit(1).single()).data?.sequence + 1 || 2,
        metadata: {
          ai_generated: true,
          confidence_score: confidenceScore,
          escalated: shouldEscalate,
          used_articles: searchResults.map((a: any) => a.id)
        },
        created_by: null, // AI generated
      })
  }

  // STEP 7: Log activity
  await emitAudit(makeCtx(accountId, personId), 'ai_support', 'item', body.case_id, null, {
    confidence_score: confidenceScore,
    escalated: shouldEscalate,
    escalation_reason: escalationReason,
    articles_used: searchResults.length
  })

  await emitActivity(makeCtx(accountId, personId), 'support.ai_processed', 
    shouldEscalate ? 'AI could not resolve case, escalated to human' : 'AI resolved case successfully', 
    'item', body.case_id)

  // STEP 8: Create agent execution record
  await db
    .from('agent_executions')
    .insert({
      account_id: accountId,
      contract_id: (await db.from('agent_contracts').select('id').eq('contract_name', 'AI Support Agent').eq('account_id', accountId).single()).data?.id,
      execution_id: `ai-support-${Date.now()}`,
      principal_id: (await db.from('principals').select('id').eq('person_id', personId).single()).data?.id,
      trigger_type: 'event',
      trigger_data: { case_id: body.case_id, user_message: body.user_message },
      execution_status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      input_data: { user_message: body.user_message, search_results_count: searchResults.length },
      output_data: { 
        response: aiResponse,
        confidence_score: confidenceScore,
        escalated: shouldEscalate,
        escalation_reason: escalationReason
      },
      created_at: new Date().toISOString(),
    })

  return json({
    response: aiResponse,
    confidence_score: confidenceScore,
    escalated: shouldEscalate,
    escalation_reason: escalationReason,
    articles_used: searchResults.length,
    articles: searchResults.map((a: any) => ({
      id: a.id,
      title: a.title,
      summary: a.summary
    }))
  })
}

async function searchKnowledge(accountId: string, query: string, priority: string) {
  // Use the existing semantic search function
  const searchUrl = `${process.env.API_URL}/semantic-search`
  const searchParams = new URLSearchParams({
    query,
    mode: 'semantic',
    entity_types: 'item',
    limit: '5',
    threshold: '0.7'
  })

  const response = await fetch(`${searchUrl}?${searchParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Search service unavailable')
  }

  const searchResults = await response.json()

  // Filter for knowledge articles only and enforce visibility
  const knowledgeArticles = []
  
  for (const result of searchResults.results || []) {
    if (result.entity_type !== 'item') continue

    // Get item details
    const { data: item } = await db
      .from('items')
      .select(`
        id,
        title,
        description,
        metadata,
        field_values!inner(field_key, value)
      `)
      .eq('account_id', accountId)
      .eq('id', result.entity_id)
      .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
      .eq('field_values.field_key', 'visibility')
      .in('field_values.value', ['member', 'operator']) // AI can use member+operator level content
      .single()

    if (item) {
      const metadata = { ...item.metadata }
      const fieldValues = item.field_values || []
      fieldValues.forEach((fv: any) => {
        metadata[fv.field_key] = fv.value
      })

      knowledgeArticles.push({
        id: item.id,
        title: item.title,
        summary: item.description,
        content: metadata.content || '',
        score: result.score || 0
      })
    }
  }

  return knowledgeArticles
}

function calculateConfidence(aiResponse: string, searchResults: any[]): number {
  // Simple confidence calculation based on:
  // 1. Number of relevant articles found
  // 2. Length and quality of AI response
  // 3. Presence of citations/references

  let confidence = 0.5 // Base confidence

  // Boost confidence if we found relevant articles
  if (searchResults.length > 0) {
    confidence += 0.2 * Math.min(searchResults.length / 3, 1)
  }

  // Boost confidence if response is substantive
  if (aiResponse.length > 100) {
    confidence += 0.1
  }

  // Boost confidence if response cites articles
  if (aiResponse.includes('according to') || aiResponse.includes('based on') || aiResponse.includes('article')) {
    confidence += 0.1
  }

  // Reduce confidence if response seems generic
  if (aiResponse.includes("don't have enough information") || aiResponse.includes("I don't know")) {
    confidence -= 0.3
  }

  return Math.max(0, Math.min(1, confidence))
}

function determineEscalationReason(aiResponse: string, searchResults: any[]): string {
  // Analyze why the AI couldn't resolve the case
  if (searchResults.length === 0) {
    return 'missing_knowledge'
  }

  if (aiResponse.includes("don't have enough information") || aiResponse.includes("I don't know")) {
    return 'missing_knowledge'
  }

  if (aiResponse.includes("not sure") || aiResponse.includes("unclear")) {
    return 'ambiguous_question'
  }

  if (aiResponse.includes("bug") || aiResponse.includes("issue") || aiResponse.includes("problem")) {
    return 'product_issue'
  }

  if (searchResults.length > 0 && aiResponse.length < 50) {
    return 'retrieval_failure'
  }

  return 'missing_knowledge' // Default
}

async function getAISupportHistory(accountId: string, caseId: string) {
  // Get AI-related messages from the case thread
  const { data: thread } = await db
    .from('threads')
    .select('id')
    .eq('target_type', 'item')
    .eq('target_id', caseId)
    .eq('account_id', accountId)
    .single()

  if (!thread) {
    return json({ history: [] })
  }

  const { data: messages } = await db
    .from('messages')
    .select(`
      content,
      direction,
      created_at,
      metadata,
      created_by
    `)
    .eq('thread_id', thread.id)
    .or('metadata->>ai_generated.eq.true OR direction.eq.inbound)')
    .order('created_at', { ascending: true })

  // Get agent execution records
  const { data: executions } = await db
    .from('agent_executions')
    .select(`
      execution_id,
      trigger_data,
      input_data,
      output_data,
      execution_status,
      started_at,
      completed_at
    `)
    .eq('account_id', accountId)
    .like('execution_id', `ai-support-%`)
    .order('started_at', { ascending: false })

  return json({
    messages: messages || [],
    executions: executions || []
  })
}
