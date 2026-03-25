import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import { evaluateAutomations } from './_shared/automation'
import { autoEmbed } from './_shared/embed'
import { ItemsDAL } from './_shared/items-dal'

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
          )
        `)
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)
      
      const schema = await ItemsDAL.getItemTypeSchema(data.item_type)
      if (schema) {
         return json(ItemsDAL.sanitizeItemData(data, schema, ctx.accountRole))
      }
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
        query = query.contains('metadata', { workflow_status: status.split(',').map(s => s.trim()) })
      } else {
        query = query.contains('metadata', { workflow_status: status })
      }
    }
    
    const { data } = await query.limit(200)
    
    if (data && itemType && !itemType.includes(',')) {
      const schema = await ItemsDAL.getItemTypeSchema(itemType)
      if (schema) {
         return json(data.map(item => ItemsDAL.sanitizeItemData(item, schema, ctx.accountRole)))
      }
    }
    
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<any>(req)
    if (!body.item_type || !body.title) {
      return error('item_type and title required')
    }

    const schema = await ItemsDAL.getItemTypeSchema(body.item_type)
    if (schema) {
      const canCreate = ItemsDAL.evaluateRecordAccess(schema, ctx.accountRole, 'create')
      if (!canCreate) {
        return error('You do not have permission to create this item type', 403)
      }
    } else {
       const roleCheck = requireRole(ctx, ['admin', 'operator'])
       if (roleCheck) return roleCheck
    }

    // Resolve creating principal
    const { data: principal } = await db
      .from('principals')
      .select('id')
      .eq('person_id', ctx.personId)
      .single()

    // Merge all field data into metadata
    const itemMetadata = {
      ...body.metadata,
      ...body.custom_fields,
      workflow_status: body.workflow_status || 'open',
      // Add any other custom fields from body
    }

    const { data, error: dbErr } = await db
      .from('items')
      .insert({
        account_id: ctx.accountId,
        app_id: body.app_id || null,
        item_type: body.item_type,
        slug: body.slug || null,
        title: body.title,
        description: body.description || null,
        is_active: body.is_active !== false,
        metadata: itemMetadata,
        created_by_principal_id: principal?.id,
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

    const schema = await ItemsDAL.getItemTypeSchema(before.item_type)
    if (schema) {
      const canUpdate = ItemsDAL.evaluateRecordAccess(schema, ctx.accountRole, 'update')
      if (canUpdate === 'none') {
        return error('You do not have permission to update this item', 403)
      }
    } else {
       const roleCheck = requireRole(ctx, ['admin', 'operator'])
       if (roleCheck) return roleCheck
    }

    const body = await parseBody<any>(req)
    
    if (schema && body.metadata) {
      const validation = ItemsDAL.validateUpdateData(body.metadata, before.metadata, schema, ctx.accountRole)
      if (!validation.valid) {
        return error(validation.error || 'Invalid update payload', 400)
      }
    }

    const updates: Record<string, any> = {}
    
    // Handle base fields (title, description)
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description
    if (body.is_active !== undefined) updates.is_active = body.is_active
    
    // Merge metadata updates
    if (body.metadata) {
      updates.metadata = { ...before.metadata, ...body.metadata }
    }
    if (body.slug !== undefined) updates.slug = body.slug

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

    if (schema) {
      return json(ItemsDAL.sanitizeItemData(data, schema, ctx.accountRole))
    }
    return json(data)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()
    if (!before) return error('Not found', 404)

    const schema = await ItemsDAL.getItemTypeSchema(before.item_type)
    let isSoftDelete = false

    if (schema) {
      const deleteAccess = ItemsDAL.evaluateRecordAccess(schema, ctx.accountRole, 'delete')
      if (deleteAccess === 'none') {
         return error('You do not have permission to delete this item', 403)
      }
      if (deleteAccess === 'soft') {
         isSoftDelete = true
      }
    } else {
       const roleCheck = requireRole(ctx, ['admin'])
       if (roleCheck) return roleCheck
    }

    if (isSoftDelete) {
       const { error: dbErr } = await db.from('items').update({ 
         is_active: false,
         archived_at: new Date().toISOString(),
         status: 'archived'
       }).eq('id', id)
   
       if (dbErr) return error(dbErr.message, 500)
   
       await emitAudit(ctx, 'archive', 'item', id, before, { ...before, is_active: false, archived_at: new Date().toISOString(), status: 'archived' })
       await emitActivity(ctx, 'item.archived', `Archived item "${before.title}"`, 'item', id)
       await emitOutboxEvent(ctx.accountId!, 'item.archived', 'item', id, { before })
   
       return json({ archived: true })
    } else {
       // Hard delete for sys admins / legacy support
       const { error: dbErr } = await db.from('items').delete().eq('id', id)
       if (dbErr) return error(dbErr.message, 500)

       await emitAudit(ctx, 'delete', 'item', id, before, null)
       await emitActivity(ctx, 'item.deleted', `Deleted item "${before.title}"`, 'item', id)
       await emitOutboxEvent(ctx.accountId!, 'item.deleted', 'item', id, { before })

       return json({ deleted: true })
    }
  },
})
