import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity, emitOutboxEvent } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const enrollmentId = params.get('enrollment_id')
    if (!enrollmentId) return error('enrollment_id is required')

    const { data } = await db
      .from('lesson_completions')
      .select('*, article:article_id(id, title, slug)')
      .eq('enrollment_id', enrollmentId)
      .eq('account_id', ctx.accountId)
      .order('completed_at', { ascending: true })

    return json(data || [])
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      enrollment_id: string
      article_id: string
      metadata?: Record<string, any>
    }>(req)

    if (!body.enrollment_id || !body.article_id) {
      return error('enrollment_id and article_id are required')
    }

    // Verify enrollment belongs to current user or admin
    const { data: enrollment } = await db
      .from('enrollments')
      .select('id, person_id, course_id')
      .eq('id', body.enrollment_id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!enrollment) return error('Enrollment not found', 404)
    if (enrollment.person_id !== ctx.personId && ctx.accountRole !== 'admin') {
      return error('Can only complete lessons for your own enrollment', 403)
    }

    const { data, error: dbErr } = await db
      .from('lesson_completions')
      .insert({
        account_id: ctx.accountId,
        enrollment_id: body.enrollment_id,
        article_id: body.article_id,
        person_id: ctx.personId,
        metadata: body.metadata || {},
      })
      .select('*, article:article_id(id, title, slug)')
      .single()

    if (dbErr) {
      if (dbErr.code === '23505') return error('Lesson already completed', 409)
      return error(dbErr.message, 500)
    }

    await emitAudit(ctx, 'create', 'lesson_completion', data.id, null, data)
    await emitActivity(
      ctx,
      'lesson_completion.created',
      `Completed lesson "${data.article?.title}"`,
      'lesson_completion',
      data.id,
      { enrollment_id: body.enrollment_id, article_id: body.article_id },
    )
    await emitOutboxEvent(ctx.accountId!, 'lesson_completion.created', 'lesson_completion', data.id, data)

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
      .from('lesson_completions')
      .select('*')
      .eq('id', id)
      .eq('account_id', ctx.accountId)
      .single()

    if (!before) return error('Not found', 404)

    if (before.person_id !== ctx.personId && ctx.accountRole !== 'admin') {
      return error('Can only uncomplete your own lessons', 403)
    }

    await db.from('lesson_completions').delete().eq('id', id)

    await emitAudit(ctx, 'delete', 'lesson_completion', id, before, null)

    return json({ success: true })
  },
})
