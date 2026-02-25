import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const entityType = params.get('entity_type')
    const entityId = params.get('entity_id')

    if (!entityType || !entityId) {
      return error('entity_type and entity_id are required')
    }

    // Check if current user is watching
    const check = params.get('check')
    if (check === 'me') {
      const { data } = await db
        .from('entity_watchers')
        .select('id')
        .eq('account_id', ctx.accountId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('person_id', ctx.personId)
        .maybeSingle()

      return json({ watching: !!data, watcher_id: data?.id || null })
    }

    const { data } = await db
      .from('entity_watchers')
      .select('*, person:person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      entity_type: string
      entity_id: string
    }>(req)

    if (!body.entity_type || !body.entity_id) {
      return error('entity_type and entity_id are required')
    }

    const { data, error: dbErr } = await db
      .from('entity_watchers')
      .insert({
        account_id: ctx.accountId,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        person_id: ctx.personId,
      })
      .select('*, person:person_id(id, full_name)')
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Already watching', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'entity_watcher', data.id, null, data)
    await emitActivity(
      ctx,
      'entity_watcher.created',
      `Started watching ${body.entity_type}`,
      body.entity_type,
      body.entity_id,
    )

    return json(data, 201)
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('entity_watchers')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    // Only the watcher or admins can unwatch
    if (before.person_id !== ctx.personId && ctx.accountRole !== 'admin') {
      return error('Only the watcher or admins can remove watches', 403)
    }

    await db.from('entity_watchers').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'entity_watcher', id, before, null)
    await emitActivity(
      ctx,
      'entity_watcher.deleted',
      `Stopped watching ${before.entity_type}`,
      before.entity_type,
      before.entity_id,
    )

    return json({ success: true })
  },
})
