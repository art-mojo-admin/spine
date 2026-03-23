import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const { data, error: dbErr } = await db
      .from('item_type_registry')
      .select('*')
      .order('is_system', { ascending: false })
      .order('label')

    if (dbErr) return error(dbErr.message, 500)
    return json(data)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.slug || !body.label) {
      return error('slug and label required')
    }

    const { data, error: dbErr } = await db
      .from('item_type_registry')
      .insert({
        slug: body.slug,
        label: body.label,
        icon: body.icon || null,
        schema: body.schema || {},
        is_system: false // custom creations are never system
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)
    return json(data, 201)
  },

  async PATCH(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.slug) return error('slug required')

    const { data, error: dbErr } = await db
      .from('item_type_registry')
      .update({
        label: body.label,
        icon: body.icon,
        schema: body.schema
      })
      .eq('slug', body.slug)
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)
    return json(data)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const slug = params.get('slug')
    if (!slug) return error('slug required')

    // Prevent deleting system types
    const { data: type } = await db.from('item_type_registry').select('is_system').eq('slug', slug).single()
    if (type?.is_system) return error('Cannot delete system item types', 403)

    const { error: dbErr } = await db
      .from('item_type_registry')
      .delete()
      .eq('slug', slug)

    if (dbErr) return error(dbErr.message, 500)
    return json({ deleted: true })
  }
})
