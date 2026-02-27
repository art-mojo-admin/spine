import { createHandler, requireAuth, json, error, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const id = params.get('id')
    const slug = params.get('slug')

    if (id) {
      const { data } = await db
        .from('integration_definitions')
        .select('*')
        .eq('id', id)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    if (slug) {
      const { data } = await db
        .from('integration_definitions')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const category = params.get('category')
    const limit = clampLimit(params)

    let query = db
      .from('integration_definitions')
      .select('*')
      .order('name')

    if (category) query = query.eq('category', category)

    const { data } = await query.limit(limit)
    return json(data || [])
  },
})
