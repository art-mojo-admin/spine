import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const mode = params.get('mode') as 'summary' | 'registry' | 'fields' | 'links' | 'usage'
    const itemTypeId = params.get('item_type_id')
    const includeSystem = params.get('include_system') === 'true'

    try {
      let result

      switch (mode) {
        case 'summary':
          result = await getTypeRegistrySummary(ctx.accountId!, includeSystem)
          break
        case 'registry':
          result = await getItemTypeRegistry(ctx.accountId!, includeSystem)
          break
        case 'usage':
          result = await getTypeUsageStatistics(ctx.accountId!)
          break
        default:
          result = await getTypeRegistrySummary(ctx.accountId!, includeSystem)
          break
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Admin types query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      slug: string
      label: string
      description?: string
      icon?: string
      lifecycle_states?: Record<string, unknown>
      default_status?: string
      allowed_link_types?: string[]
      embedding_strategy?: Record<string, unknown>
      indexing_hints?: Record<string, unknown>
      permission_behavior?: Record<string, unknown>
      display_hints?: Record<string, unknown>
      search_config?: Record<string, unknown>
      ownership?: 'system' | 'pack' | 'tenant'
      validate_before_create?: boolean
    }>(req)

    if (!body.slug) return error('slug required')
    if (!body.label) return error('label required')

    try {
      const result = await createItemType(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Item type creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const itemTypeId = params.get('item_type_id')
    if (!itemTypeId) return error('item_type_id required')

    const body = await parseBody<{
      label?: string
      description?: string
      icon?: string
      lifecycle_states?: Record<string, unknown>
      default_status?: string
      allowed_link_types?: string[]
      embedding_strategy?: Record<string, unknown>
      indexing_hints?: Record<string, unknown>
      permission_behavior?: Record<string, unknown>
      display_hints?: Record<string, unknown>
      search_config?: Record<string, unknown>
    }>(req)

    try {
      const result = await updateItemType(ctx, itemTypeId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Item type update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const itemTypeId = params.get('item_type_id')
    if (!itemTypeId) return error('item_type_id required')

    try {
      await deleteItemType(ctx, itemTypeId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Item type deletion failed', 500)
    }
  },
})

async function getTypeRegistrySummary(accountId: string, includeSystem?: boolean) {
  const { data } = await db
    .from('admin_type_registry_summary')
    .select('*')
    .order('slug', { ascending: true })

  return data || []
}

async function getItemTypeRegistry(accountId: string, includeSystem?: boolean) {
  let query = db
    .from('item_type_registry')
    .select('*')
    .order('slug', { ascending: true })

  if (!includeSystem) {
    query = query.eq('ownership', 'tenant')
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}


async function getTypeUsageStatistics(accountId: string) {
  const { data } = await db
    .from('item_type_registry')
    .select(`
      slug,
      label,
      (
        SELECT COUNT(*) 
        FROM items 
        WHERE items.item_type = item_type_registry.slug 
          AND items.account_id = ${accountId}
      ) as item_count,
      (
        SELECT COUNT(*) 
        FROM item_links 
        WHERE item_links.account_id = ${accountId}
          AND (
            item_links.source_item_id IN (SELECT id FROM items WHERE item_type = item_type_registry.slug AND account_id = ${accountId})
            OR item_links.target_item_id IN (SELECT id FROM items WHERE item_type = item_type_registry.slug AND account_id = ${accountId})
          )
      ) as link_count
    `)
    .order('slug', { ascending: true })

  return data || []
}

async function createItemType(ctx: any, body: any) {
  // Check if item type already exists
  const { data: existing } = await db
    .from('item_type_registry')
    .select('id')
    .eq('slug', body.slug)
    .single()

  if (existing) throw new Error('Item type with this slug already exists')

  // Validate item type if requested
  if (body.validate_before_create) {
    await validateItemTypeDefinition(body)
  }

  const { data } = await db
    .from('item_type_registry')
    .insert({
      slug: body.slug,
      label: body.label,
      description: body.description || null,
      icon: body.icon || null,
      lifecycle_states: body.lifecycle_states || {},
      default_status: body.default_status || 'active',
      allowed_link_types: body.allowed_link_types || [],
      embedding_strategy: body.embedding_strategy || {},
      indexing_hints: body.indexing_hints || {},
      permission_behavior: body.permission_behavior || {},
      display_hints: body.display_hints || {},
      search_config: body.search_config || {},
      ownership: body.ownership || 'tenant'
    })
    .select()
    .single()

  if (!data) throw new Error('Failed to create item type')

  await emitAudit(ctx, 'create', 'item_type_registry', data.slug, null, body)
  await emitActivity(ctx, 'item_type.created', `Created item type ${body.label}`, 'item_type_registry', data.slug)

  return {
    item_type_id: data.slug,
    slug: body.slug,
    label: body.label,
    message: 'Item type created successfully'
  }
}

async function updateItemType(ctx: any, itemTypeId: string, updates: any) {
  const { data: before } = await db
    .from('item_type_registry')
    .select('*')
    .eq('slug', itemTypeId)
    .single()

  if (!before) throw new Error('Item type not found')

  // Prevent modification of system types by non-admins
  if (before.ownership === 'system' && ctx.role !== 'system_admin') {
    throw new Error('Cannot modify system item types')
  }

  const updateData: Record<string, unknown> = {}
  if (updates.label) updateData.label = updates.label
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.icon) updateData.icon = updates.icon
  if (updates.lifecycle_states) updateData.lifecycle_states = updates.lifecycle_states
  if (updates.default_status) updateData.default_status = updates.default_status
  if (updates.allowed_link_types) updateData.allowed_link_types = updates.allowed_link_types
  if (updates.embedding_strategy) updateData.embedding_strategy = updates.embedding_strategy
  if (updates.indexing_hints) updateData.indexing_hints = updates.indexing_hints
  if (updates.permission_behavior) updateData.permission_behavior = updates.permission_behavior
  if (updates.display_hints) updateData.display_hints = updates.display_hints
  if (updates.search_config) updateData.search_config = updates.search_config

  const { data } = await db
    .from('item_type_registry')
    .update(updateData)
    .eq('slug', itemTypeId)
    .select()
    .single()

  if (!data) throw new Error('Failed to update item type')

  await emitAudit(ctx, 'update', 'item_type_registry', itemTypeId, before, data)
  await emitActivity(ctx, 'item_type.updated', `Updated item type ${data.label}`, 'item_type_registry', itemTypeId)

  return data
}

async function deleteItemType(ctx: any, itemTypeId: string) {
  const { data: before } = await db
    .from('item_type_registry')
    .select('*')
    .eq('slug', itemTypeId)
    .single()

  if (!before) throw new Error('Item type not found')

  // Prevent deletion of system types
  if (before.ownership === 'system') {
    throw new Error('Cannot delete system item types')
  }

  // Check if type is in use
  const { data: itemsUsingType } = await db
    .from('items')
    .select('id')
    .eq('item_type', itemTypeId)
    .limit(1)

  if (itemsUsingType && itemsUsingType.length > 0) {
    throw new Error('Cannot delete item type that is in use by items')
  }

  const { error } = await db
    .from('item_type_registry')
    .delete()
    .eq('slug', itemTypeId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'item_type_registry', itemTypeId, before, null)
  await emitActivity(ctx, 'item_type.deleted', `Deleted item type ${before.label}`, 'item_type_registry', itemTypeId)
}

async function validateItemTypeDefinition(itemType: any) {
  const errors: string[] = []

  // Validate slug format
  if (!/^[a-z0-9_-]+$/.test(itemType.slug)) {
    errors.push('Slug must contain only lowercase letters, numbers, hyphens, and underscores')
  }

  // Validate lifecycle states
  if (itemType.lifecycle_states && typeof itemType.lifecycle_states === 'object') {
    const states = Object.keys(itemType.lifecycle_states)
    if (states.length === 0) {
      errors.push('At least one lifecycle state must be defined')
    }

    // Check if default status exists in lifecycle states
    if (itemType.default_status && !states.includes(itemType.default_status)) {
      errors.push('Default status must be defined in lifecycle states')
    }
  }

  // Validate allowed link types
  if (itemType.allowed_link_types && Array.isArray(itemType.allowed_link_types)) {
    for (const linkType of itemType.allowed_link_types) {
      if (typeof linkType !== 'string') {
        errors.push('Link types must be strings')
        break
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`)
  }
}


export async function getTypeHierarchy(accountId: string) {
  // Get all item types
  const { data } = await db
    .from('item_type_registry')
    .select(`
      slug,
      label,
      allowed_link_types
    `)
    .order('slug', { ascending: true })

  return data || []
}

      
