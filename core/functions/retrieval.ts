import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { retrieveItems, getItemById, getItemLinks } from './_shared/retrieval'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const mode = params.get('mode') as 'exact' | 'filtered' | 'traversal' | 'semantic' | 'hybrid' | 'read_model'
    const itemId = params.get('item_id')
    const slug = params.get('slug')
    const linkType = params.get('link_type')

    if (itemId || slug) {
      // Exact lookup by ID or slug
      try {
        const item = await getItemById(ctx.accountId!, itemId || slug!)
        if (!item) return error('Item not found', 404)
        
        // Include links if requested
        if (linkType || params.get('include_links') === 'true') {
          const links = await getItemLinks(ctx.accountId!, item.id, linkType || undefined)
          return json({ ...item, links })
        }
        
        return json(item)
      } catch (err: any) {
        return error(err.message || 'Failed to retrieve item', 500)
      }
    }

    // General retrieval with filters
    const filters: Record<string, unknown> = {}
    
    // Parse query parameters as filters
    for (const [key, value] of params.entries()) {
      if (key === 'mode' || key === 'limit' || key === 'offset') continue
      
      if (value.includes(',')) {
        // Handle comma-separated values for IN queries
        filters[key] = value.split(',').map(v => v.trim())
      } else {
        filters[key] = value
      }
    }

    const limit = parseInt(params.get('limit') || '100')
    const offset = parseInt(params.get('offset') || '0')
    const sortParam = params.get('sort') || 'created_at:desc'
    const sort = sortParam.split(',').map(s => s.trim())

    try {
      const results = await retrieveItems({
        account_id: ctx.accountId!,
        mode: mode || 'filtered',
        filters,
        limit,
        offset,
        sort,
      })

      return json(results)
    } catch (err: any) {
      return error(err.message || 'Retrieval failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      mode: 'exact' | 'filtered' | 'traversal' | 'semantic' | 'hybrid' | 'read_model'
      filters?: Record<string, unknown>
      limit?: number
      offset?: number
      sort?: string[]
      include_links?: boolean
      link_type?: string
    }>(req)

    if (!body.mode) return error('mode required')

    try {
      if (body.mode === 'exact' && (body.filters?.id || body.filters?.slug)) {
        const itemId = body.filters.id as string
        const slug = body.filters.slug as string
        
        const item = await getItemById(ctx.accountId!, itemId || slug!)
        if (!item) return error('Item not found', 404)
        
        // Include links if requested
        if (body.include_links || body.link_type) {
          const links = await getItemLinks(ctx.accountId!, item.id, body.link_type)
          return json({ ...item, links })
        }
        
        return json(item)
      }

      const results = await retrieveItems({
        account_id: ctx.accountId!,
        mode: body.mode,
        filters: body.filters || {},
        limit: body.limit || 100,
        offset: body.offset || 0,
        sort: body.sort || ['created_at:desc'],
      })

      return json(results)
    } catch (err: any) {
      return error(err.message || 'Retrieval failed', 500)
    }
  },
})
