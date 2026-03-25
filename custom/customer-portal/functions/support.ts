import { createHandler, requireAuth, requireTenant, json, error, parseBody, type RequestContext } from '../../../core/functions/_shared/middleware'
import { db } from '../../../core/functions/_shared/db'
import { emitAudit, emitActivity } from '../../../core/functions/_shared/audit'
import { ItemsDAL, type ItemTypeSchema } from '../../../core/functions/_shared/items-dal'

function makeCtx(accountId: string, personId: string): RequestContext {
  return { requestId: '', personId, accountId, accountNodeId: null, accountRole: null, principalScopes: [], systemRole: null, authUid: null, impersonating: false, realPersonId: null, impersonationSessionId: null }
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

    // Derive effective role — system_admin always gets admin
    const effectiveRole = ctx.systemRole === 'system_admin' ? 'admin' : (ctx.accountRole || 'member')

    try {
      switch (mode) {
        case 'list':
          return await listCases(ctx.accountId!, ctx.personId!, { status, priority }, effectiveRole)
        case 'detail':
          if (!itemId) return error('item_id required')
          return await getCase(ctx.accountId!, ctx.personId!, itemId, effectiveRole)
        case 'queue':
          return await getSupportQueue(ctx.accountId!, ctx.personId!, effectiveRole)
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

    const effectiveRole = ctx.systemRole === 'system_admin' ? 'admin' : (ctx.accountRole || 'member')
    try {
      return await createCase(ctx.accountId!, ctx.personId!, body, effectiveRole)
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
      status?: string
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

async function listCases(accountId: string, personId: string, filters: { status?: string | null; priority?: string | null }, callerRole: string) {

  let query = db
    .from('items')
    .select(`
      id,
      title,
      description,
      metadata,
      created_at,
      updated_at,
      created_by_principal_id
    `)
    .eq('account_id', accountId)
    .eq('item_type', 'support_case')
    .eq('is_active', true)

  // Members can only see their own cases
  if (callerRole === 'member') {
    query = query.eq('created_by_principal_id', personId)
  }

  // Apply filters
  if (filters.status) {
    query = query.contains('metadata', { workflow_status: filters.status })
  }
  if (filters.priority) {
    query = query.contains('metadata', { priority: filters.priority })
  }

  const { data, error: dbErr } = await query

  if (dbErr) throw dbErr

  // Transform to v2 format
  const cases = (data || []).map(item => {
    const metadata = item.metadata || {}

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      metadata: metadata,
      status: metadata.workflow_status || 'open',
      created_at: item.created_at,
      updated_at: item.updated_at,
      created_by_principal_id: item.created_by_principal_id,
    }
  })

  return json(cases)
}

async function getCase(accountId: string, personId: string, itemId: string, callerRole: string) {

  const { data, error: dbErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      status,
      metadata,
      custom_fields,
      created_at,
      updated_at,
      created_by
    `)
    .eq('account_id', accountId)
    .eq('item_type', 'support_case')
    .eq('is_active', true)
    .eq('id', itemId)
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

async function getSupportQueue(accountId: string, personId: string, callerRole: string) {
  // Only operators and admins can see the queue
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

async function createCase(accountId: string, personId: string, body: any, callerRole: string) {

  // Get item type schema for validation
  const schema = await ItemsDAL.getItemTypeSchema('support_case')
  if (!schema) {
    return error('Support case item type not found', 404)
  }

  // Check create permissions
  const canCreate = ItemsDAL.evaluateRecordAccess(schema, callerRole, 'create')
  if (!canCreate) {
    return error('Insufficient permissions to create support cases', 403)
  }

  // Validate and sanitize input data
  const validatedData = ItemsDAL.validateUpdateData(body, {}, schema, callerRole)
  if (!validatedData) {
    return error('Invalid data provided', 400)
  }

  // Get workflow and item type
  const { data: itemType } = await db
    .from('item_type_registry')
    .select('id, default_workflow_id')
    .eq('slug', 'support_case')
    .single()

  const workflowId = itemType?.default_workflow_id

  // Map fields to metadata according to schema
  const metadata = {
    workflow_status: 'open',
    priority: validatedData.priority || 'medium',
    category: validatedData.category || 'general',
    tags: validatedData.tags || [],
    ai_attempted: false, // Portal users can't set this
  }

  const { data, error: dbErr } = await db
    .from('items')
    .insert({
      account_id: accountId,
      item_type: 'support_case',
      workflow_definition_id: workflowId,
      title: validatedData.title,
      description: validatedData.description,
      is_active: true,
      metadata: metadata,
      created_by_principal_id: personId,
    })
    .select()
    .single()

  if (dbErr) throw dbErr


    
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
  if (body.priority) metadata.priority = body.priority
  if (body.ai_confidence_score !== undefined) metadata.ai_confidence_score = body.ai_confidence_score
  if (body.escalation_reason) metadata.escalation_reason = body.escalation_reason
  if (body.ai_summary) metadata.ai_summary = body.ai_summary
  if (body.resolution_kind) metadata.resolution_kind = body.resolution_kind
  if (body.resolution_notes) metadata.resolution_notes = body.resolution_notes

  // Handle workflow status transitions
  if (body.status) {
    metadata.workflow_status = body.status
  }

  updateData.metadata = metadata
  updateData.updated_at = new Date().toISOString()

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
