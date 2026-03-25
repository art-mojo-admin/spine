import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    // Get the item type slug from query params
    const url = new URL(req.url)
    const itemType = url.searchParams.get('type')
    
    if (!itemType) {
      return error('Item type parameter is required', 400)
    }

    // Fetch the specific item type schema
    const { data, error: dbErr } = await db
      .from('item_type_registry')
      .select('slug, label, schema')
      .eq('slug', itemType)
      .eq('is_active', true)
      .single()

    if (dbErr) {
      if (dbErr.code === 'PGRST116') {
        return error('Item type not found', 404)
      }
      return error(dbErr.message, 500)
    }

    if (!data) {
      return error('Item type not found', 404)
    }

    // Return the schema data
    return json({
      slug: data.slug,
      label: data.label,
      schema: data.schema
    })
  }
})
