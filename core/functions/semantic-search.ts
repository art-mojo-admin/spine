import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const query = params.get('query')
    const mode = params.get('mode') as 'semantic' | 'hybrid' | 'full_text'
    const entityTypes = params.get('entity_types')?.split(',').map(t => t.trim())
    const limit = parseInt(params.get('limit') || '20')
    const threshold = parseFloat(params.get('threshold') || '0.7')
    const semanticWeight = parseFloat(params.get('semantic_weight') || '0.6')

    if (!query) return error('query required')

    try {
      let result

      switch (mode) {
        case 'semantic':
          result = await semanticSearch(ctx.accountId!, query, entityTypes, limit, threshold)
          break
        case 'hybrid':
          const filters = parseFilters(params)
          result = await hybridSearch(ctx.accountId!, query, filters, entityTypes, limit, threshold, semanticWeight)
          break
        case 'full_text':
          result = await fullTextSearch(ctx.accountId!, query, entityTypes, limit)
          break
        default:
          result = await semanticSearch(ctx.accountId!, query, entityTypes, limit, threshold)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Search failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      query: string
      mode: 'semantic' | 'hybrid' | 'full_text'
      entity_types?: string[]
      limit?: number
      threshold?: number
      semantic_weight?: number
      filters?: Record<string, unknown>
    }>(req)

    if (!body.query) return error('query required')
    if (!body.mode) return error('mode required')

    try {
      let result

      switch (body.mode) {
        case 'semantic':
          result = await semanticSearch(ctx.accountId!, body.query, body.entity_types, body.limit, body.threshold)
          break
        case 'hybrid':
          result = await hybridSearch(ctx.accountId!, body.query, body.filters || {}, body.entity_types, body.limit, body.threshold, body.semantic_weight)
          break
        case 'full_text':
          result = await fullTextSearch(ctx.accountId!, body.query, body.entity_types, body.limit)
          break
        default:
          throw new Error(`Unsupported mode: ${body.mode}`)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Search failed', 500)
    }
  },
})

async function semanticSearch(
  accountId: string,
  query: string,
  entityTypes?: string[],
  limit: number = 20,
  threshold: number = 0.7
) {
  // Generate embedding for query (placeholder - would call OpenAI API)
  const queryVector = await generateEmbedding(query)
  
  const { data, error } = await db.rpc('semantic_search', {
    search_account_id: accountId,
    search_query_vector: queryVector,
    search_entity_types: entityTypes || null,
    search_limit: limit,
    search_threshold: threshold
  })

  if (error) throw error

  return {
    mode: 'semantic',
    query,
    results: data || [],
    total_results: (data || []).length
  }
}

async function hybridSearch(
  accountId: string,
  query: string,
  filters: Record<string, unknown>,
  entityTypes?: string[],
  limit: number = 20,
  threshold: number = 0.5,
  semanticWeight: number = 0.6
) {
  // Generate embedding for query
  const queryVector = await generateEmbedding(query)
  
  const { data, error } = await db.rpc('hybrid_search', {
    search_account_id: accountId,
    search_query_vector: queryVector,
    search_filters: filters,
    search_entity_types: entityTypes || null,
    search_limit: limit,
    search_threshold: threshold,
    semantic_weight: semanticWeight
  })

  if (error) throw error

  return {
    mode: 'hybrid',
    query,
    filters,
    semantic_weight: semanticWeight,
    results: data || [],
    total_results: (data || []).length
  }
}

async function fullTextSearch(
  accountId: string,
  query: string,
  entityTypes?: string[],
  limit: number = 20
) {
  let searchQuery = db
    .from('items')
    .select(`
      id,
      title,
      slug,
      item_type,
      status,
      description,
      metadata,
      custom_fields,
      created_at,
      updated_at
    `)
    .eq('account_id', accountId)

  // Apply text search
  searchQuery = searchQuery.or(`
    title.ilike.%${query}%,description.ilike.%${query}%
  `)

  // Apply entity type filter
  if (entityTypes && entityTypes.length > 0) {
    searchQuery = searchQuery.in('item_type', entityTypes)
  }

  const { data, error } = await searchQuery.limit(limit)

  if (error) throw error

  // Calculate relevance scores (simple text matching)
  const resultsWithScores = (data || []).map(item => ({
    ...item,
    semantic_score: 0,
    filter_score: calculateTextRelevance(item, query),
    hybrid_score: calculateTextRelevance(item, query)
  }))

  return {
    mode: 'full_text',
    query,
    results: resultsWithScores,
    total_results: resultsWithScores.length
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Placeholder for actual embedding generation
  // In production, this would call OpenAI's embedding API
  const dimensions = 1536
  return new Array(dimensions).fill(0).map(() => Math.random())
}

function calculateTextRelevance(item: any, query: string): number {
  const title = item.title || ''
  const description = item.description || ''
  const content = `${title} ${description}`.toLowerCase()
  const queryLower = query.toLowerCase()
  
  let score = 0
  
  // Title matches are worth more
  if (title.toLowerCase().includes(queryLower)) {
    score += 0.8
  }
  
  // Description matches
  if (description.toLowerCase().includes(queryLower)) {
    score += 0.4
  }
  
  // Word-level matching
  const queryWords = queryLower.split(' ')
  const contentWords = content.split(' ')
  
  for (const queryWord of queryWords) {
    for (const contentWord of contentWords) {
      if (contentWord.includes(queryWord)) {
        score += 0.2
      }
    }
  }
  
  return Math.min(score, 1.0)
}

function parseFilters(params: URLSearchParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {}
  
  for (const [key, value] of params.entries()) {
    if (key.startsWith('filter_')) {
      const filterKey = key.replace('filter_', '')
      filters[filterKey] = value
    }
  }
  
  return filters
}
