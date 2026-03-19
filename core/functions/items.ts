import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import { evaluateAutomations } from './_shared/automation'
import { autoEmbed } from './_shared/embed'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('items')
        .select(`
          *,
          principals:created_by_principal_id (
            id,
            principal_type,
            display_name,
            status
          ),
          owner_accounts:owner_account_id (
            id,
            display_name,
            account_type
          )
        `)
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const parentId = params.get('parent_id')
    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    const itemType = params.get('item_type')
    const status = params.get('status')
    
    let query = db
      .from('items')
      .select(`
        *,
        principals:created_by_principal_id (
          id,
          principal_type,
          display_name,
          status
        ),
        owner_accounts:owner_account_id (
          id,
          display_name,
          account_type
        )
      `)
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (!includeInactive) query = query.eq('is_active', true)
    if (itemType) {
      if (itemType.includes(',')) {
        query = query.in('item_type', itemType.split(',').map(s => s.trim()))
      } else {
        query = query.eq('item_type', itemType)
      }
    }
    if (status) {
      if (status.includes(',')) {
        query = query.in('status', status.split(',').map(s => s.trim()))
      } else {
        query = query.eq('status', status)
      }
    }
    if (parentId === 'null') query = query.is('parent_item_id', null)
    else if (parentId) query = query.eq('parent_item_id', parentId)

    const { data } = await query.limit(200)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.item_type || !body.title) {
      return error('item_type and title required')
    }

    // Resolve creating principal
    const { data: principal } = await db
      .from('principals')
      .select('id')
      .eq('person_id', ctx.personId)
      .single()

    const { data, error: dbErr } = await db
      .from('items')
      .insert({
        account_id: ctx.accountId,
        item_type: body.item_type,
        slug: body.slug || null,
        title: body.title,
        status: body.status || 'active',
        description: body.description || null,
        metadata: body.metadata || {},
        parent_item_id: body.parent_item_id || null,
        owner_account_id: body.owner_account_id || ctx.accountId,
        created_by_principal_id: principal?.id,
        custom_fields: body.custom_fields || {},
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'item', data.id, null, data)
    await emitActivity(ctx, 'item.created', `Created item "${data.title}"`, 'item', data.id)
    await emitOutboxEvent(ctx.accountId!, 'item.created', 'item', data.id, data)
    await evaluateAutomations(ctx.accountId!, 'item.created', ctx, data)
    await autoEmbed(ctx.accountId!, 'item', data.id, `${data.title} ${data.description || ''}`, { title: data.title })

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    // Get current item for version check
    const { data: before } = await db
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()
    if (!before) return error('Not found', 404)

    const body = await parseBody<any>(req)
    
    // Version check for optimistic locking
    if (body.version !== undefined && body.version !== before.version) {
      return error('Version conflict - item has been modified', 409)
    }

    const updates: Record<string, any> = {
      version: (before.version || 1) + 1, // Increment version
    }
    
    if (body.title !== undefined) updates.title = body.title
    if (body.slug !== undefined) updates.slug = body.slug
    if (body.description !== undefined) updates.description = body.description
    if (body.status !== undefined) updates.status = body.status
    if (body.archived_at !== undefined) updates.archived_at = body.archived_at
    if (body.metadata !== undefined) updates.metadata = body.metadata
    if (body.parent_item_id !== undefined) updates.parent_item_id = body.parent_item_id
    if (body.custom_fields !== undefined) updates.custom_fields = body.custom_fields
    if (body.owner_account_id !== undefined) updates.owner_account_id = body.owner_account_id

    // Resolve updating principal
    const { data: principal } = await db
      .from('principals')
      .select('id')
      .eq('person_id', ctx.personId)
      .single()
    
    if (principal?.id) updates.updated_by_principal_id = principal.id

    const { data, error: dbErr } = await db.from('items').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    const eventType = body.status !== before.status ? 'item.status_changed' : 'item.updated'
    const activitySummary = body.status !== before.status 
      ? `"${data.title}" → ${body.status}`
      : `Updated item "${data.title}"`

    await emitAudit(ctx, 'update', 'item', id, before, data)
    await emitActivity(ctx, eventType, activitySummary, 'item', id)
    await emitOutboxEvent(ctx.accountId!, eventType, 'item', id, { before, after: data })
    await evaluateAutomations(ctx.accountId!, eventType, ctx, { before, after: data })
    await autoEmbed(ctx.accountId!, 'item', id, `${data.title} ${data.description || ''}`, { title: data.title })

    return json(data)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()
    if (!before) return error('Not found', 404)

    const { error: dbErr } = await db.from('items').update({ 
      archived_at: new Date().toISOString(),
      status: 'archived'
    }).eq('id', id)

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'archive', 'item', id, before, { ...before, archived_at: new Date().toISOString(), status: 'archived' })
    await emitActivity(ctx, 'item.archived', `Archived item "${before.title}"`, 'item', id)
    await emitOutboxEvent(ctx.accountId!, 'item.archived', 'item', id, { before })

    return json({ archived: true })
  },
})
