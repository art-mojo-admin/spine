import { createHandler, requireAuth, requireTenant, json, error, parseBody } from '../../core/functions/_shared/middleware'
import { db } from '../../core/functions/_shared/db'
import { emitAudit, emitActivity } from '../../core/functions/_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const mode = params.get('mode') || 'list'
    const itemId = params.get('item_id')
    const postKind = params.get('post_kind')
    const moderationStatus = params.get('moderation_status')

    try {
      switch (mode) {
        case 'list':
          return await listPosts(ctx.accountId!, { postKind, moderationStatus })
        case 'detail':
          if (!itemId) return error('item_id required')
          return await getPost(ctx.accountId!, ctx.personId!, itemId)
        case 'my-posts':
          return await getMyPosts(ctx.accountId!, ctx.personId!)
        case 'moderation-queue':
          return await getModerationQueue(ctx.accountId!, ctx.personId!)
        default:
          return error('Invalid mode')
      }
    } catch (err: any) {
      return error(err.message || 'Community query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      title: string
      content: string
      post_kind: string
      category?: string
      tags?: string[]
      pinned?: boolean
    }>(req)

    if (!body.title || !body.content || !body.post_kind) {
      return error('title, content, and post_kind required')
    }

    try {
      return await createPost(ctx.accountId!, ctx.personId!, body)
    } catch (err: any) {
      return error(err.message || 'Post creation failed', 500)
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
      content?: string
      post_kind?: string
      category?: string
      tags?: string[]
      pinned?: boolean
      moderation_status?: string
      moderation_reason?: string
      moderation_action?: string
    }>(req)

    try {
      return await updatePost(ctx.accountId!, ctx.personId!, itemId, body)
    } catch (err: any) {
      return error(err.message || 'Post update failed', 500)
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
      return await deletePost(ctx.accountId!, ctx.personId!, itemId)
    } catch (err: any) {
      return error(err.message || 'Post deletion failed', 500)
    }
  },
})

async function listPosts(accountId: string, filters: { postKind?: string, moderationStatus?: string }) {
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
      field_values!inner(field_key, value),
      persons!inner(full_name, email)
    `)
    .eq('account_id', accountId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'community_post').single()).data?.id)
    .eq('status', 'active')

  // Apply filters
  if (filters.postKind) {
    query = query.eq('field_values.field_key', 'post_kind').eq('field_values.value', filters.postKind)
  }
  
  if (filters.moderationStatus) {
    query = query.eq('field_values.field_key', 'moderation_status').eq('field_values.value', filters.moderationStatus)
  }

  // Order by pinned first, then by created_at
  query = query.order('created_at', { ascending: false })

  const { data, error: dbErr } = await query

  if (dbErr) throw dbErr

  // Transform field values
  const posts = (data || []).map(item => {
    const metadata = { ...item.metadata }
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
      stage: item.stage_definitions?.name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      created_by: item.created_by,
      creator: item.persons,
    }
  })

  // Sort pinned posts to top
  posts.sort((a, b) => {
    const aPinned = a.metadata.pinned || false
    const bPinned = b.metadata.pinned || false
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  return json(posts)
}

async function getPost(accountId: string, personId: string, itemId: string) {
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
    .eq('id', itemId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'community_post').single()).data?.id)
    .eq('status', 'active')
    .single()

  if (dbErr) throw dbErr
  if (!data) return error('Post not found', 404)

  // Transform field values
  const metadata = { ...data.metadata }
  const fieldValues = data.field_values || []
  
  fieldValues.forEach((fv: any) => {
    metadata[fv.field_key] = fv.value
  })

  // Get thread/replies
  const { data: thread } = await db
    .from('threads')
    .select(`
      id,
      status,
      messages!inner(content, direction, created_at, created_by, persons!inner(full_name, email))
    `)
    .eq('target_type', 'item')
    .eq('target_id', itemId)
    .eq('account_id', accountId)
    .single()

  // Get linked knowledge articles
  const { data: linkedArticles } = await db
    .from('item_links')
    .select(`
      target_item_id,
      items!inner(title, description, metadata)
    `)
    .eq('source_item_id', itemId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'discusses').single()).data?.id)

  // Check if user can edit (owner or moderator)
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'
  const canEdit = data.created_by === personId || callerRole === 'admin' || callerRole === 'operator'

  const postDetail = {
    id: data.id,
    title: data.title,
    description: data.description,
    metadata,
    status: data.status,
    stage: data.stage_definitions?.name,
    created_at: data.created_at,
    updated_at: data.updated_at,
    created_by: data.created_by,
    creator: data.persons,
    thread: thread || null,
    linked_articles: linkedArticles || [],
    can_edit: canEdit,
  }

  return json(postDetail)
}

async function getMyPosts(accountId: string, personId: string) {
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
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'community_post').single()).data?.id)
    .eq('status', 'active')
    .eq('created_by', personId)
    .order('updated_at', { ascending: false })

  if (dbErr) throw dbErr

  // Transform field values
  const posts = (data || []).map(item => {
    const metadata = { ...item.metadata }
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
      stage: item.stage_definitions?.name,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }
  })

  return json(posts)
}

async function getModerationQueue(accountId: string, personId: string) {
  // Only operators and admins can see moderation queue
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
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'community_post').single()).data?.id)
    .eq('status', 'active')
    .eq('field_values.field_key', 'moderation_status')
    .in('field_values.value', ['reported', 'under_review'])
    .order('updated_at', { ascending: false })

  if (dbErr) throw dbErr

  // Transform field values
  const queue = (data || []).map(item => {
    const metadata = { ...item.metadata }
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
      stage: item.stage_definitions?.name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      created_by: item.created_by,
      creator: item.persons,
    }
  })

  return json(queue)
}

async function createPost(accountId: string, personId: string, body: any) {
  // Get item type and initial stage
  const { data: itemType } = await db
    .from('item_type_registry')
    .select('id')
    .eq('slug', 'community_post')
    .single()

  const { data: activeStage } = await db
    .from('stage_definitions')
    .select('id')
    .eq('name', 'Active')
    .eq('workflow_definition_id', (await db.from('workflow_definitions').select('id').eq('name', 'Community Moderation').eq('account_id', accountId).single()).data?.id)
    .single()

  const { data, error: dbErr } = await db
    .from('items')
    .insert({
      account_id: accountId,
      item_type_id: itemType?.id,
      workflow_definition_id: (await db.from('workflow_definitions').select('id').eq('name', 'Community Moderation').eq('account_id', accountId).single()).data?.id,
      stage_definition_id: activeStage?.id,
      title: body.title,
      description: body.content,
      metadata: {
        post_kind: body.post_kind,
        category: body.category || 'general',
        tags: body.tags || [],
        pinned: body.pinned || false,
        moderation_status: 'active',
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
    { field_key: 'post_kind', value: body.post_kind },
    { field_key: 'category', value: body.category || 'general' },
    { field_key: 'tags', value: body.tags || [] },
    { field_key: 'pinned', value: body.pinned || false },
    { field_key: 'moderation_status', value: 'active' },
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

  // Create thread for replies
  const { data: thread } = await db
    .from('threads')
    .insert({
      account_id: accountId,
      target_type: 'item',
      target_id: data.id,
      status: 'active',
      visibility: 'public',
      created_by: personId,
    })
    .select()
    .single()

  // Add initial post content as first message
  await db
    .from('messages')
    .insert({
      account_id: accountId,
      thread_id: thread?.id,
      content: body.content,
      direction: 'inbound',
      sequence: 1,
      created_by: personId,
    })

  await emitAudit({ accountId, personId }, 'create', 'item', data.id, null, data)
  await emitActivity({ accountId, personId }, 'community.created', `Created ${body.post_kind}: ${body.title}`, 'item', data.id)

  return json(data, 201)
}

async function updatePost(accountId: string, personId: string, itemId: string, body: any) {
  // Get current post
  const { data: current, error: fetchErr } = await db
    .from('items')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', itemId)
    .single()

  if (fetchErr) throw fetchErr
  if (!current) return error('Post not found', 404)

  // Check permissions for moderation actions
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'
  const isModerator = callerRole === 'admin' || callerRole === 'operator'
  const isOwner = current.created_by === personId

  // Check if user can perform this update
  if (body.moderation_status || body.moderation_reason || body.moderation_action) {
    if (!isModerator) {
      return error('Access denied', 403)
    }
  } else if (!isOwner && !isModerator) {
    return error('Access denied', 403)
  }

  // Prepare update data
  const updateData: any = {}
  const metadata = { ...current.metadata }

  if (body.title) updateData.title = body.title
  if (body.content) updateData.description = body.content
  if (body.post_kind) metadata.post_kind = body.post_kind
  if (body.category) metadata.category = body.category
  if (body.tags) metadata.tags = body.tags
  if (body.pinned !== undefined) metadata.pinned = body.pinned
  if (body.moderation_status) metadata.moderation_status = body.moderation_status
  if (body.moderation_reason) metadata.moderation_reason = body.moderation_reason
  if (body.moderation_action) metadata.moderation_action = body.moderation_action

  updateData.metadata = metadata
  updateData.updated_at = new Date().toISOString()

  // Handle moderation status changes
  if (body.moderation_status) {
    const { data: newStage } = await db
      .from('stage_definitions')
      .select('id')
      .eq('name', body.moderation_status === 'active' ? 'Active' : 
               body.moderation_status === 'reported' ? 'Reported' :
               body.moderation_status === 'under_review' ? 'Under Review' :
               body.moderation_status === 'action_taken' ? 'Action Taken' : 'Dismissed')
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
    if (value !== undefined && ['post_kind', 'category', 'tags', 'pinned', 'moderation_status', 'moderation_reason', 'moderation_action'].includes(key)) {
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

  // Log moderation actions
  if (body.moderation_status || body.moderation_action) {
    await emitAudit({ accountId, personId }, 'moderate', 'item', itemId, current, data)
    await emitActivity({ accountId, personId }, 'community.moderated', 
      `Moderated post: ${data.title} (${body.moderation_status || body.moderation_action})`, 
      'item', itemId)
  } else {
    await emitAudit({ accountId, personId }, 'update', 'item', itemId, current, data)
    await emitActivity({ accountId, personId }, 'community.updated', `Updated post: ${data.title}`, 'item', itemId)
  }

  return json(data)
}

async function deletePost(accountId: string, personId: string, itemId: string) {
  const { data: current, error: fetchErr } = await db
    .from('items')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', itemId)
    .single()

  if (fetchErr) throw fetchErr
  if (!current) return error('Post not found', 404)

  // Check permissions (owner or moderator)
  const { data: caller } = await db
    .from('memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('person_id', personId)
    .single()

  const callerRole = caller?.account_role || 'member'
  if (current.created_by !== personId && callerRole === 'member') {
    return error('Access denied', 403)
  }

  const { error: dbErr } = await db
    .from('items')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', itemId)

  if (dbErr) throw dbErr

  await emitAudit({ accountId, personId }, 'delete', 'item', itemId, current, null)
  await emitActivity({ accountId, personId }, 'community.deleted', `Deleted post: ${current.title}`, 'item', itemId)

  return json({ success: true })
}
