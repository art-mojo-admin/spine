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
      .from('tenant_roles')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('is_system', { ascending: false })
      .order('display_name')

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
    if (!body.slug || !body.display_name) {
      return error('slug and display_name required')
    }

    const { data, error: dbErr } = await db
      .from('tenant_roles')
      .insert({
        account_id: ctx.accountId,
        slug: body.slug,
        display_name: body.display_name,
        description: body.description || null
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
    if (!body.id) return error('id required')

    // Prevent modifying system roles
    const { data: role } = await db.from('tenant_roles').select('is_system').eq('id', body.id).single()
    if (role?.is_system) return error('Cannot modify system roles', 403)

    const { data, error: dbErr } = await db
      .from('tenant_roles')
      .update({
        display_name: body.display_name,
        description: body.description || null
      })
      .eq('id', body.id)
      .eq('account_id', ctx.accountId)
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

    const id = params.get('id')
    if (!id) return error('id required')

    // Prevent deleting system roles
    const { data: role } = await db.from('tenant_roles').select('is_system').eq('id', id).single()
    if (role?.is_system) return error('Cannot delete system roles', 403)

    const { error: dbErr } = await db
      .from('tenant_roles')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId)

    if (dbErr) return error(dbErr.message, 500)
    return json({ deleted: true })
  }
})
