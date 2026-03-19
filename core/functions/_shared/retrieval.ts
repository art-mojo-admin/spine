import { db } from './db'

export interface RetrievalOptions {
  account_id: string
  mode: 'exact' | 'filtered' | 'traversal' | 'semantic' | 'hybrid' | 'read_model'
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
  sort?: string[]
}

/**
 * Phase A retrieval implementation
 * Supports exact lookup and filtered queries
 */
export async function retrieveItems(options: RetrievalOptions) {
  const { account_id, mode, filters = {}, limit = 100, offset = 0, sort = ['created_at:desc'] } = options

  switch (mode) {
    case 'exact':
      return exactLookup(account_id, filters, limit, offset)
    case 'filtered':
      return filteredQuery(account_id, filters, limit, offset, sort)
    case 'traversal':
      throw new Error('Traversal mode not yet implemented (Phase B)')
    case 'semantic':
      throw new Error('Semantic search not yet implemented (Phase B)')
    case 'hybrid':
      throw new Error('Hybrid search not yet implemented (Phase B)')
    case 'read_model':
      throw new Error('Read models not yet implemented (Phase B)')
    default:
      throw new Error(`Unsupported retrieval mode: ${mode}`)
  }
}

/**
 * Exact lookup by ID or slug
 */
async function exactLookup(accountId: string, filters: Record<string, unknown>, limit: number, offset: number) {
  const { id, slug } = filters

  if (!id && !slug) {
    throw new Error('Exact lookup requires either id or slug')
  }

  let query = db
    .from('items')
    .select(`
      *,
      principals:created_by_principal_id (
        id,
        principal_type,
        display_name
      ),
      owner_accounts:owner_account_id (
        id,
        display_name,
        account_type
      )
    `)
    .eq('account_id', accountId)

  if (id) {
    query = query.eq('id', id)
  } else if (slug) {
    query = query.eq('slug', slug)
  }

  const { data, error } = await query.limit(1)
  if (error) throw error
  return data?.[0] || null
}

/**
 * Filtered query with field validation
 */
async function filteredQuery(
  accountId: string,
  filters: Record<string, unknown>,
  limit: number,
  offset: number,
  sort: string[]
) {
  // Build base query
  let query = db
    .from('items')
    .select(`
      *,
      principals:created_by_principal_id (
        id,
        principal_type,
        display_name
      ),
      owner_accounts:owner_account_id (
        id,
        display_name,
        account_type
      )
    `)
    .eq('account_id', accountId)

  // Apply validated filters
  const validatedFilters = validateFilters(filters)
  for (const [key, value] of Object.entries(validatedFilters)) {
    if (Array.isArray(value)) {
      query = query.in(key, value)
    } else {
      query = query.eq(key, value)
    }
  }

  // Apply sorting
  for (const sortSpec of sort) {
    const [field, direction] = sortSpec.split(':')
    const ascending = direction === 'asc'
    query = query.order(field, { ascending })
  }

  // Apply pagination
  if (offset > 0) {
    query = query.range(offset, offset + limit - 1)
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Validate and sanitize filters to prevent injection
 */
function validateFilters(filters: Record<string, unknown>): Record<string, unknown> {
  const allowedFields = [
    'id',
    'slug',
    'item_type',
    'status',
    'workflow_definition_id',
    'stage_definition_id',
    'owner_account_id',
    'created_by_principal_id',
    'is_active',
    'parent_item_id'
  ]

  const validated: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(filters)) {
    if (!allowedFields.includes(key)) {
      throw new Error(`Invalid filter field: ${key}`)
    }

    // Basic type validation
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      validated[key] = value
    } else if (Array.isArray(value) && value.length > 0) {
      // Validate array elements
      const firstType = typeof value[0]
      if (['string', 'number', 'boolean'].includes(firstType)) {
        validated[key] = value
      } else {
        throw new Error(`Invalid filter value type for ${key}: ${firstType}`)
      }
    } else if (value === null || value === undefined) {
      // Skip null/undefined values
      continue
    } else {
      throw new Error(`Invalid filter value type for ${key}: ${typeof value}`)
    }
  }

  return validated
}

/**
 * Get item by ID with related data
 */
export async function getItemById(accountId: string, itemId: string) {
  const { data, error } = await db
    .from('items')
    .select(`
      *,
      principals:created_by_principal_id (
        id,
        principal_type,
        display_name
      ),
      owner_accounts:owner_account_id (
        id,
        display_name,
        account_type
      ),
      field_definitions:account_id!inner (
        field_key,
        field_type,
        field_label,
        is_required,
        default_value,
        validation_rules,
        display_config
      )
    `)
    .eq('account_id', accountId)
    .eq('id', itemId)
    .single()

  if (error) throw error
  return data
}

/**
 * Get item links for traversal
 */
export async function getItemLinks(accountId: string, itemId: string, linkType?: string) {
  let query = db
    .from('item_links')
    .select(`
      *,
      source_items:source_item_id (
        id,
        title,
        slug,
        item_type,
        status
      ),
      target_items:target_item_id (
        id,
        title,
        slug,
        item_type,
        status
      )
    `)
    .eq('account_id', accountId)

  if (linkType) {
    query = query.eq('link_type', linkType)
  }

  // Get both incoming and outgoing links
  const { data, error } = await query.or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`)
  if (error) throw error

  return data || []
}
