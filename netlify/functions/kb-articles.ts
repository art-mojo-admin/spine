import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'
import { autoEmbed } from './_shared/embed'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('knowledge_base_articles')
        .select('*, author:author_person_id(id, full_name)')
        .eq('id', id)
        .or(`account_id.eq.${ctx.accountId},is_global.eq.true`)
        .single()

      if (!data) return error('Not found', 404)
      return json(data)
    }

    const status = params.get('status')
    let query = db
      .from('knowledge_base_articles')
      .select('id, title, slug, status, category, is_global, published_at, created_at, updated_at, author:author_person_id(id, full_name)')
      .or(`account_id.eq.${ctx.accountId},is_global.eq.true`)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data } = await query.limit(200)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    if (!body.title) return error('title required')

    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const { data, error: dbErr } = await db
      .from('knowledge_base_articles')
      .insert({
        account_id: ctx.accountId,
        title: body.title,
        slug,
        body: body.body || '',
        status: body.status || 'draft',
        category: body.category || null,
        author_person_id: ctx.personId,
      })
      .select()
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'create', 'kb_article', data.id, null, data)
    await emitActivity(ctx, 'kb.created', `Created article "${data.title}"`, 'kb_article', data.id)
    await emitOutboxEvent(ctx.accountId!, 'kb.created', 'kb_article', data.id, data)
    await autoEmbed(ctx.accountId!, 'kb_article', data.id, `${data.title} ${data.body || ''}`, { title: data.title })

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db.from('knowledge_base_articles').select('*').eq('id', id).or(`account_id.eq.${ctx.accountId},is_global.eq.true`).single()
    if (!before) return error('Not found', 404)
    if (before.is_global && ctx.systemRole !== 'system_admin') return error('Only system admins can edit global articles', 403)

    const body = await parseBody<any>(req)
    const updates: Record<string, any> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.slug !== undefined) updates.slug = body.slug
    if (body.body !== undefined) updates.body = body.body
    if (body.category !== undefined) updates.category = body.category
    if (body.metadata !== undefined) updates.metadata = { ...(before.metadata || {}), ...body.metadata }
    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === 'published' && !before.published_at) {
        updates.published_at = new Date().toISOString()
      }
    }

    const { data, error: dbErr } = await db.from('knowledge_base_articles').update(updates).eq('id', id).select().single()
    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'kb_article', id, before, data)
    await emitActivity(ctx, 'kb.updated', `Updated article "${data.title}"`, 'kb_article', id)
    await emitOutboxEvent(ctx.accountId!, 'kb.updated', 'kb_article', id, { before, after: data })
    await autoEmbed(ctx.accountId!, 'kb_article', id, `${data.title} ${data.body || ''}`, { title: data.title })

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

    const { data: before } = await db.from('knowledge_base_articles').select('*').eq('id', id).or(`account_id.eq.${ctx.accountId},is_global.eq.true`).single()
    if (!before) return error('Not found', 404)
    if (before.is_global && ctx.systemRole !== 'system_admin') return error('Only system admins can delete global articles', 403)

    await db.from('knowledge_base_articles').delete().eq('id', id)
    await emitAudit(ctx, 'delete', 'kb_article', id, before, null)
    await emitActivity(ctx, 'kb.deleted', `Deleted article "${before.title}"`, 'kb_article', id)
    await emitOutboxEvent(ctx.accountId!, 'kb.deleted', 'kb_article', id, before)

    return json({ success: true })
  },
})
