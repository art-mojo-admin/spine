import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const itemId = params.get('item_id')
    const direction = params.get('direction') as 'outbound' | 'inbound' | 'both'
    const linkTypes = params.get('link_types')?.split(',').map(t => t.trim())
    const maxDepth = parseInt(params.get('max_depth') || '5')
    const mode = params.get('mode') as 'traverse' | 'network' | 'shortest_path' | 'related_by_type'

    if (!itemId) return error('item_id required')

    try {
      let result

      switch (mode) {
        case 'traverse':
          result = await traverseItems(ctx.accountId!, itemId, direction || 'both', linkTypes, maxDepth)
          break
        case 'network':
          const radius = parseInt(params.get('radius') || '2')
          result = await getItemNetwork(ctx.accountId!, itemId, radius, linkTypes)
          break
        case 'shortest_path':
          const targetId = params.get('target_item_id')
          if (!targetId) return error('target_item_id required for shortest_path mode')
          result = await findShortestPath(ctx.accountId!, itemId, targetId, linkTypes, maxDepth)
          break
        case 'related_by_type':
          const targetType = params.get('target_item_type')
          if (!targetType) return error('target_item_type required for related_by_type mode')
          result = await getRelatedItemsByType(ctx.accountId!, itemId, targetType, linkTypes, maxDepth)
          break
        default:
          result = await traverseItems(ctx.accountId!, itemId, direction || 'both', linkTypes, maxDepth)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Traversal failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      item_id: string
      mode: 'traverse' | 'network' | 'shortest_path' | 'related_by_type'
      direction?: 'outbound' | 'inbound' | 'both'
      link_types?: string[]
      max_depth?: number
      radius?: number
      target_item_id?: string
      target_item_type?: string
    }>(req)

    if (!body.item_id) return error('item_id required')
    if (!body.mode) return error('mode required')

    try {
      let result

      switch (body.mode) {
        case 'traverse':
          result = await traverseItems(ctx.accountId!, body.item_id, body.direction || 'both', body.link_types, body.max_depth || 5)
          break
        case 'network':
          result = await getItemNetwork(ctx.accountId!, body.item_id, body.radius || 2, body.link_types)
          break
        case 'shortest_path':
          if (!body.target_item_id) return error('target_item_id required for shortest_path mode')
          result = await findShortestPath(ctx.accountId!, body.item_id, body.target_item_id, body.link_types, body.max_depth || 10)
          break
        case 'related_by_type':
          if (!body.target_item_type) return error('target_item_type required for related_by_type mode')
          result = await getRelatedItemsByType(ctx.accountId!, body.item_id, body.target_item_type, body.link_types, body.max_depth || 3)
          break
        default:
          throw new Error(`Unsupported mode: ${body.mode}`)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Traversal failed', 500)
    }
  },
})

async function traverseItems(
  accountId: string,
  itemId: string,
  direction: 'outbound' | 'inbound' | 'both',
  linkTypes?: string[],
  maxDepth: number = 5
) {
  const { data, error } = await db.rpc('traverse_item_links', {
    start_item_id: itemId,
    direction,
    link_types: linkTypes || null,
    max_depth: maxDepth
  })

  if (error) throw error

  // Enrich with item details
  const enrichedPaths = []
  for (const path of data || []) {
    const itemDetails = await getItemDetails(path.item_id)
    enrichedPaths.push({
      ...path,
      item_details: itemDetails
    })
  }

  return enrichedPaths
}

async function getItemNetwork(
  accountId: string,
  itemId: string,
  radius: number,
  linkTypes?: string[]
) {
  const { data, error } = await db.rpc('get_item_network', {
    center_item_id: itemId,
    radius,
    link_types: linkTypes || null
  })

  if (error) throw error

  // Enrich with item details
  const networkItems = []
  for (const item of data || []) {
    const itemDetails = await getItemDetails(item.item_id)
    networkItems.push({
      ...item,
      item_details: itemDetails
    })
  }

  return networkItems
}

async function findShortestPath(
  accountId: string,
  fromItemId: string,
  toItemId: string,
  linkTypes?: string[],
  maxDepth: number = 10
) {
  const { data, error } = await db.rpc('find_shortest_path', {
    from_item_id: fromItemId,
    to_item_id: toItemId,
    link_types: linkTypes || null,
    max_depth: maxDepth
  })

  if (error) throw error

  if (!data || data.length === 0) {
    return { path_found: false, message: 'No path found between items' }
  }

  const path = data[0]
  
  // Enrich path with item details
  const enrichedPath = []
  for (const itemId of path.item_path) {
    const itemDetails = await getItemDetails(itemId)
    enrichedPath.push(itemDetails)
  }

  return {
    path_found: true,
    path_length: path.path_length,
    item_path: path.item_path,
    link_path: path.link_path,
    enriched_items: enrichedPath
  }
}

async function getRelatedItemsByType(
  accountId: string,
  itemId: string,
  targetType: string,
  linkTypes?: string[],
  maxDepth: number = 3
) {
  const { data, error } = await db.rpc('get_related_items_by_type', {
    item_id: itemId,
    target_item_type: targetType,
    link_pattern: linkTypes ? linkTypes.join('|') : '%',
    max_depth: maxDepth
  })

  if (error) throw error

  // Enrich with item details
  const relatedItems = []
  for (const item of data || []) {
    const itemDetails = await getItemDetails(item.related_item_id)
    relatedItems.push({
      ...item,
      item_details: itemDetails
    })
  }

  return relatedItems
}

async function getItemDetails(itemId: string) {
  const { data, error } = await db
    .from('items')
    .select(`
      id,
      title,
      slug,
      item_type,
      status,
      created_at,
      updated_at,
      metadata,
      custom_fields
    `)
    .eq('id', itemId)
    .single()

  if (error) throw error
  return data
}
