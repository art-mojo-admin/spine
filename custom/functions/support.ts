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
    const status = params.get('status')
    const priority = params.get('priority')

    try {
      switch (mode) {
        case 'list':
          return await listCases(ctx.accountId!, ctx.personId!, { status, priority })
        case 'detail':
          if (!itemId) return error('item_id required')
          return await getCase(ctx.accountId!, ctx.personId!, itemId)
        case 'queue':
          return await getSupportQueue(ctx.accountId!, ctx.personId!)
        case 'my-cases':
          return await getMyCases(ctx.accountId!, ctx.personId!)
        default:
          return error('Invalid mode')
      }
    } catch (err: any) {
      return error(err.message || 'Support query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      title: string
      description: string
      priority: string
      category?: string
      tags?: string[]
      ai_attempted?: boolean
    }>(req)

    if (!body.title || !body.description) {
      return error('title and description required')
    }

    try {
      return await createCase(ctx.accountId!, ctx.personId!, body)
    } catch (err: any) {
      return error(err.message || 'Case creation failed', 500)
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
      description?: string
      priority?: string
      stage?: string
      ai_confidence_score?: number
      escalation_reason?: string
      ai_summary?: string
      resolution_kind?: string
      resolution_notes?: string
      assigned_to?: string
    }>(req)

    try {
      return await updateCase(ctx.accountId!, ctx.personId!, itemId, body)
    } catch (err: any) {
      return error(err.message || 'Case update failed', 500)
    }
  },
})

async function listCases(accountId: string, personId: string, filters: { status?: string, priority?: string }) {
  // Get the caller's role to enforce access
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'

  let query = db
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
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'support_case').single()).data?.id)
    .eq('status', 'active')

  // Members can only see their own cases
  if (callerRole === 'member') {
    query = query.eq('created_by', personId)
  }

  // Apply filters
  if (filters.status) {
    query = query.eq('stage_definitions.name', filters.status)
  }
  if (filters.priority) {
    query = query.eq('field_values.field_key', 'priority').eq('field_values.value', filters.priority)
  }

  const { data, error: dbErr } = await query

  if (dbErr) throw dbErr

  // Transform field values
  const cases = (data || []).map(item => {
    const metadata = item.metadata || {}
    const fieldValues = item.field_values || []
    
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

  return json(cases)
}

async function getCase(accountId: string, personId: string, itemId: string) {
  // Get the caller's role to enforce access
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'

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
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'support_case').single()).data?.id)
    .eq('status', 'active')
    .single()

  if (dbErr) throw dbErr
  if (!data) return error('Case not found', 404)

  // Check access permissions
  if (callerRole === 'member' && data.created_by !== personId) {
    return error('Access denied', 403)
  }

  // Transform field values
  const metadata = data.metadata || {}
  const fieldValues = data.field_values || []
  
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
  })

  // Get thread/conversation
  const { data: thread } = await db
    .from('threads')
    .select(`
      id,
      status,
      messages!inner(content, direction, created_at, created_by)
    `)
    .eq('target_type', 'item')
    .eq('target_id', itemId)
    .eq('account_id', accountId)
    .single()

  // Get referenced knowledge articles
  const { data: references } = await db
    .from('item_links')
    .select(`
      target_item_id,
      items!inner(title, description, metadata)
    `)
    .eq('source_item_id', itemId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'references').single()).data?.id)

  // Get resulted knowledge articles
  const { data: resultedIn } = await db
    .from('item_links')
    .select(`
      target_item_id,
      items!inner(title, description, metadata, stage_definitions!inner(name))
    `)
    .eq('source_item_id', itemId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'resulted_in').single()).data?.id)

  const caseDetail = {
    id: data.id,
    title: data.title,
    description: data.description,
    metadata,
    status: data.status,
    stage: (data.stage_definitions as any)?.name,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    thread: thread || null,
    referenced_articles: references || [],
    resulted_in_articles: resultedIn || [],
  }

  return json(caseDetail)
}

async function getSupportQueue(accountId: string, personId: string) {
  // Only operators and admins can see the queue
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
      field_values!inner(field_key, value),
      persons!inner(full_name, email)
    `)
    .eq('account_id', accountId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'support_case').single()).data?.id)
    .eq('status', 'active')
    .in('stage_definitions.name', ['Open', 'AI Attempt', 'Escalated', 'In Progress'])
    .order('created_at', { ascending: false })

  if (dbErr) throw dbErr

  // Transform field values
  const queue = (data || []).map(item => {
    const metadata = item.metadata || {}
    const fieldValues = item.field_values || []
    
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
      creator: item.persons,
    }
  })

  return json(queue)
}

async function getMyCases(accountId: string, personId: string) {
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
      stage_definitions!inner(name),
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'support_case').single()).data?.id)
    .eq('status', 'active')
    .eq('created_by', personId)
    .order('updated_at', { ascending: false })

  if (dbErr) throw dbErr

  // Transform field values
  const cases = (data || []).map(item => {
    const metadata = item.metadata || {}
    const fieldValues = item.field_values || []
    
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
    }
  })

  return json(cases)
}

async function createCase(accountId: string, personId: string, body: any) {
  // Get item type and initial stage
  const { data: itemType } = await db
    .from('item_type_registry')
    .select('id')
    .eq('slug', 'support_case')
    .single()

  const { data: openStage } = await db
    .from('stage_definitions')
    .select('id')
    .eq('name', 'Open')
    .eq('workflow_definition_id', (await db.from('workflow_definitions').select('id').eq('name', 'Support Case Lifecycle').eq('account_id', accountId).single()).data?.id)
    .single()

  const { data, error: dbErr } = await db
    .from('items')
    .insert({
      account_id: accountId,
      item_type_id: itemType?.id,
      workflow_definition_id: (await db.from('workflow_definitions').select('id').eq('name', 'Support Case Lifecycle').eq('account_id', accountId).single()).data?.id,
      stage_definition_id: openStage?.id,
      title: body.title,
      description: body.description,
      metadata: {
        priority: body.priority,
        category: body.category,
        tags: body.tags || [],
        ai_attempted: body.ai_attempted || false,
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
    { field_key: 'priority', value: body.priority },
    { field_key: 'category', value: body.category || 'general' },
    { field_key: 'tags', value: body.tags || [] },
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

  // Create thread for the case
  const { data: thread } = await db
    .from('threads')
    .insert({
      account_id: accountId,
      target_type: 'item',
      target_id: data.id,
      status: 'active',
      visibility: 'private',
      created_by: personId,
    })
    .select()
    .single()

  // Add initial message to thread
  await db
    .from('messages')
    .insert({
      account_id: accountId,
      thread_id: thread?.id,
      content: body.description,
      direction: 'inbound',
      sequence: 1,
      created_by: personId,
    })

  await emitAudit(makeCtx(accountId, personId), 'create', 'item', data.id, null, data)
  await emitActivity(makeCtx(accountId, personId), 'support.created', `Created support case: ${body.title}`, 'item', data.id)

  return json(data, 201)
}

async function updateCase(accountId: string, personId: string, itemId: string, body: any) {
  // Get current case
  const { data: current, error: fetchErr } = await db
    .from('items')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', itemId)
    .single()

  if (fetchErr) throw fetchErr
  if (!current) return error('Case not found', 404)

  // Prepare update data
  const updateData: any = {}
  const metadata = { ...current.metadata }

  if (body.title) updateData.title = body.title
  if (body.description) updateData.description = body.description
  if (body.priority) {
    metadata.priority = body.priority
  }
  if (body.ai_confidence_score !== undefined) metadata.ai_confidence_score = body.ai_confidence_score
  if (body.escalation_reason) metadata.escalation_reason = body.escalation_reason
  if (body.ai_summary) metadata.ai_summary = body.ai_summary
  if (body.resolution_kind) metadata.resolution_kind = body.resolution_kind
  if (body.resolution_notes) metadata.resolution_notes = body.resolution_notes

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
    if (value !== undefined && ['priority', 'ai_confidence_score', 'escalation_reason', 'ai_summary', 'resolution_kind', 'resolution_notes'].includes(key)) {
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

  // Handle escalation to operator
  if (body.stage === 'Escalated' && body.assigned_to) {
    await db
      .from('item_links')
      .insert({
        account_id: accountId,
        source_item_id: itemId,
        target_item_id: body.assigned_to,
        link_type_id: (await db.from('link_type_registry').select('id').eq('slug', 'escalated_to').single()).data?.id,
        created_by: personId,
      })
  }

  await emitAudit(makeCtx(accountId, personId), 'update', 'item', itemId, current, data)
  await emitActivity(makeCtx(accountId, personId), 'support.updated', `Updated support case: ${data.title}`, 'item', itemId)

  return json(data)
}
