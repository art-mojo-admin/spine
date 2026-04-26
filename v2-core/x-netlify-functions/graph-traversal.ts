import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List graph edges
export const listEdges = createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, edge_type, is_active, limit = 100, offset = 0 } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  let query = db
    .from('graph_edges')
    .select(`
      *,
      created_by_person:people(id, full_name, email)
    `)
    .eq('account_id', ctx.accountId)
    .order('created_at', { ascending: false })

  if (source_type) query = query.eq('source_type', source_type)
  if (source_id) query = query.eq('source_id', source_id)
  if (target_type) query = query.eq('target_type', target_type)
  if (target_id) query = query.eq('target_id', target_id)
  if (edge_type) query = query.eq('edge_type', edge_type)
  if (is_active !== undefined) query = query.eq('is_active', is_active === 'true')

  const { data, error: err } = await query.range(
    parseInt(offset.toString()),
    parseInt(offset.toString()) + parseInt(limit.toString()) - 1
  )

  if (err) throw err
  return data
})

// Create graph edge
export const createEdge = requireAuth(createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, edge_type, edge_data, weight, is_directed, metadata } = body

  if (!source_type || !source_id || !target_type || !target_id || !edge_type) {
    throw new Error('source_type, source_id, target_type, target_id, and edge_type are required')
  }

  const { data, error: err } = await db
    .rpc('create_graph_edge', {
      source_type,
      source_id,
      target_type,
      target_id,
      edge_type,
      edge_data: edge_data || {},
      weight: weight || 1.0,
      is_directed: is_directed !== false,
      metadata: metadata || {},
      created_by: ctx.personId,
      account_id: ctx.accountId!
    })

  if (err) throw err

  await emitLog(ctx, 'graph_edge.created', 
    { type: 'graph_edge', id: data }, 
    { after: { source_type, source_id, target_type, target_id, edge_type } }
  )

  return { edge_id: data }
}))

// Update graph edge
export const updateEdge = requireAuth(createHandler(async (ctx, body) => {
  const { id, edge_data, weight, is_active, metadata } = body

  if (!id) {
    throw new Error('Edge ID is required')
  }

  const { data, error: err } = await db
    .rpc('update_graph_edge', {
      edge_id: id,
      edge_data,
      weight,
      is_active,
      metadata
    })

  if (err) throw err

  await emitLog(ctx, 'graph_edge.updated', 
    { type: 'graph_edge', id }, 
    { after: { is_active } }
  )

  return { success: data }
}))

// Delete graph edge
export const deleteEdge = requireAuth(createHandler(async (ctx, body) => {
  const { id } = body

  if (!id) {
    throw new Error('Edge ID is required')
  }

  const { data, error: err } = await db
    .rpc('delete_graph_edge', { edge_id: id })

  if (err) throw err

  await emitLog(ctx, 'graph_edge.deleted', 
    { type: 'graph_edge', id }, 
    {}
  )

  return { success: data }
}))

// Find graph neighbors
export const findNeighbors = createHandler(async (ctx, body) => {
  const { source_type, source_id, edge_types, max_depth, include_inactive } = ctx.query || {}

  if (!source_type || !source_id) {
    throw new Error('source_type and source_id are required')
  }

  const { data, error: err } = await db
    .rpc('find_graph_neighbors', {
      source_type,
      source_id,
      edge_types: edge_types ? JSON.parse(edge_types as string) : null,
      max_depth: max_depth ? parseInt(max_depth.toString()) : 1,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err
  return data
})

// Find shortest path
export const findShortestPath = createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, edge_types, max_path_length } = body

  if (!source_type || !source_id || !target_type || !target_id) {
    throw new Error('source_type, source_id, target_type, and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('find_shortest_path', {
      source_type,
      source_id,
      target_type,
      target_id,
      edge_types: edge_types || null,
      max_path_length: max_path_length || 10
    })

  if (err) throw err
  return data
})

// Find all paths
export const findAllPaths = createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, edge_types, max_path_length } = body

  if (!source_type || !source_id || !target_type || !target_id) {
    throw new Error('source_type, source_id, target_type, and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('find_all_paths', {
      source_type,
      source_id,
      target_type,
      target_id,
      edge_types: edge_types || null,
      max_path_length: max_path_length || 10
    })

  if (err) throw err
  return data
})

// Get graph statistics
export const getStats = createHandler(async (ctx, body) => {
  const { edge_types } = ctx.query || {}

  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_graph_statistics', {
      account_id: ctx.accountId,
      edge_types: edge_types ? JSON.parse(edge_types as string) : null
    })

  if (err) throw err
  return data
})

// Cache graph path
export const cachePath = requireAuth(createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, path_type, path_length, path_weight, path_nodes, path_edges, algorithm, expires_in_hours } = body

  if (!source_type || !source_id || !target_type || !target_id || !path_type) {
    throw new Error('source_type, source_id, target_type, target_id, and path_type are required')
  }

  const { data, error: err } = await db
    .rpc('cache_graph_path', {
      source_type,
      source_id,
      target_type,
      target_id,
      path_type,
      path_length: path_length || 1,
      path_weight: path_weight || 1.0,
      path_nodes: path_nodes || [],
      path_edges: path_edges || [],
      algorithm: algorithm || 'bfs',
      expires_in_hours: expires_in_hours || 24,
      account_id: ctx.accountId!
    })

  if (err) throw err

  await emitLog(ctx, 'graph_path.cached', 
    { type: 'graph_path', id: data }, 
    { after: { source_type, source_id, target_type, target_id, path_type } }
  )

  return { path_id: data }
}))

// Get cached path
export const getCachedPath = createHandler(async (ctx, body) => {
  const { source_type, source_id, target_type, target_id, path_type } = ctx.query || {}

  if (!source_type || !source_id || !target_type || !target_id) {
    throw new Error('source_type, source_id, target_type, and target_id are required')
  }

  const { data, error: err } = await db
    .rpc('get_cached_graph_path', {
      source_type,
      source_id,
      target_type,
      target_id,
      path_type: path_type || 'shortest'
    })

  if (err) throw err
  return data
})

// Cleanup expired paths
export const cleanupPaths = requireAuth(createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('cleanup_expired_graph_paths')

  if (err) throw err

  await emitLog(ctx, 'graph_paths.cleaned', 
    { type: 'system', id: 'batch_cleanup' }, 
    { after: { deleted_count: data } }
  )

  return { deleted_count: data }
}))

// Validate graph integrity
export const validateIntegrity = createHandler(async (ctx, body) => {
  if (!ctx.accountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('validate_graph_integrity', {
      account_id: ctx.accountId
    })

  if (err) throw err
  return data
})

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'neighbors':
      if (method === 'GET') {
        return await findNeighbors(ctx, body)
      }
      break
    case 'shortest-path':
      if (method === 'POST') {
        return await findShortestPath(ctx, body)
      }
      break
    case 'all-paths':
      if (method === 'POST') {
        return await findAllPaths(ctx, body)
      }
      break
    case 'stats':
      if (method === 'GET') {
        return await getStats(ctx, body)
      }
      break
    case 'cache-path':
      if (method === 'POST') {
        return await cachePath(ctx, body)
      }
      break
    case 'cached-path':
      if (method === 'GET') {
        return await getCachedPath(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanupPaths(ctx, body)
      }
      break
    case 'validate':
      if (method === 'GET') {
        return await validateIntegrity(ctx, body)
      }
      break
    default:
      if (method === 'GET') {
        return await listEdges(ctx, body)
      } else if (method === 'POST') {
        return await createEdge(ctx, body)
      } else if (method === 'PATCH') {
        return await updateEdge(ctx, body)
      } else if (method === 'DELETE') {
        return await deleteEdge(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
