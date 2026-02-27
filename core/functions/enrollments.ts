import { createHandler, requireAuth, requireTenant, json, error, parseBody, clampLimit } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (id) {
      const { data } = await db
        .from('enrollments')
        .select('*, course:course_id(id, title, slug), person:person_id(id, full_name)')
        .eq('id', id)
        .eq('account_id', ctx.accountId)
        .single()

      if (!data) return error('Not found', 404)

      // Get lesson count and completion count for progress
      const { data: lessons } = await db
        .from('knowledge_base_articles')
        .select('id')
        .eq('account_id', ctx.accountId)
        .not('parent_article_id', 'is', null)

      const { data: completions } = await db
        .from('lesson_completions')
        .select('id')
        .eq('enrollment_id', id)

      return json({
        ...data,
        progress: {
          completed: completions?.length || 0,
        },
      })
    }

    const courseId = params.get('course_id')
    const personId = params.get('person_id')
    const check = params.get('check')
    const limit = clampLimit(params)

    // Check if current user is enrolled in a specific course
    if (check === 'me' && courseId) {
      const { data } = await db
        .from('enrollments')
        .select('id, status')
        .eq('account_id', ctx.accountId)
        .eq('course_id', courseId)
        .eq('person_id', ctx.personId)
        .maybeSingle()

      return json({ enrolled: !!data, enrollment_id: data?.id || null, status: data?.status || null })
    }

    const includeInactive = params.get('include_inactive') === 'true' && ctx.accountRole === 'admin'
    let query = db
      .from('enrollments')
      .select('*, course:course_id(id, title, slug), person:person_id(id, full_name)')
      .eq('account_id', ctx.accountId)
      .order('enrolled_at', { ascending: false })

    if (!includeInactive) query = query.eq('is_active', true)
    if (courseId) query = query.eq('course_id', courseId)
    if (personId) query = query.eq('person_id', personId)

    const { data } = await query.limit(limit)
    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      course_id: string
      person_id?: string
      metadata?: Record<string, any>
    }>(req)

    if (!body.course_id) return error('course_id is required')

    const personId = body.person_id || ctx.personId

    const { data, error: dbErr } = await db
      .from('enrollments')
      .insert({
        account_id: ctx.accountId,
        course_id: body.course_id,
        person_id: personId,
        metadata: body.metadata || {},
      })
      .select('*, course:course_id(id, title, slug), person:person_id(id, full_name)')
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Already enrolled', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'enrollment', data.id, null, data)
    await emitActivity(ctx, 'enrollment.created', `Enrolled in "${data.course?.title}"`, 'enrollment', data.id)
    await emitOutboxEvent(ctx.accountId!, 'enrollment.created', 'enrollment', data.id, data)

    return json(data, 201)
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const id = params.get('id')
    if (!id) return error('id required')

    const { data: before } = await db
      .from('enrollments')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    const body = await parseBody<{
      status?: string
      metadata?: Record<string, any>
    }>(req)

    const updates: Record<string, any> = {}
    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === 'completed' && !before.completed_at) {
        updates.completed_at = new Date().toISOString()
      }
    }
    if (body.metadata !== undefined) updates.metadata = { ...(before.metadata || {}), ...body.metadata }

    const { data, error: dbErr } = await db
      .from('enrollments')
      .update(updates)
      .eq('id', id)
      .select('*, course:course_id(id, title, slug), person:person_id(id, full_name)')
      .single()

    if (dbErr) return error(dbErr.message, 500)

    await emitAudit(ctx, 'update', 'enrollment', id, before, data)
    await emitActivity(ctx, 'enrollment.updated', `Updated enrollment status to "${data.status}"`, 'enrollment', id)

    return json(data)
  },
})
