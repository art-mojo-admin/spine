import { createHandler, json, error, requireAuth, parseBody, type RequestContext } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

function requireSystemAdmin(ctx: RequestContext) {
  if (!ctx.systemRole || !['system_admin', 'system_operator'].includes(ctx.systemRole)) {
    return error('Only system admins can impersonate users', 403)
  }
  return null
}

export default createHandler({
  // GET: return the caller's active impersonation session (if any)
  async GET(req, ctx, params) {
    const authErr = requireAuth(ctx)
    if (authErr) return authErr
    const adminErr = requireSystemAdmin(ctx)
    if (adminErr) return adminErr

    const sessionId = params.get('session_id')

    if (sessionId) {
      // Look up specific session
      const { data: session } = await db
        .from('impersonation_sessions')
        .select(`
          id, admin_person_id, target_person_id, target_account_id,
          target_account_role, reason, started_at, expires_at, ended_at, status
        `)
        .eq('id', sessionId)
        .eq('admin_person_id', ctx.personId)
        .single()

      if (!session) return error('Session not found', 404)
      return json({ session })
    }

    // Return active session for this admin
    const { data: session } = await db
      .from('impersonation_sessions')
      .select(`
        id, admin_person_id, target_person_id, target_account_id,
        target_account_role, reason, started_at, expires_at, ended_at, status
      `)
      .eq('admin_person_id', ctx.personId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Enrich with target person and account names
    if (session) {
      const [{ data: targetPerson }, { data: targetAccount }] = await Promise.all([
        db.from('persons').select('id, full_name, email').eq('id', session.target_person_id).single(),
        db.from('accounts').select('id, display_name').eq('id', session.target_account_id).single(),
      ])
      return json({
        session: {
          ...session,
          target_person: targetPerson,
          target_account: targetAccount,
        },
      })
    }

    return json({ session: null })
  },

  // POST: start impersonation
  async POST(req, ctx) {
    const authErr = requireAuth(ctx)
    if (authErr) return authErr
    const adminErr = requireSystemAdmin(ctx)
    if (adminErr) return adminErr

    const body = await parseBody<{
      target_person_id: string
      target_account_id: string
      reason?: string
    }>(req)

    if (!body.target_person_id || !body.target_account_id) {
      return error('target_person_id and target_account_id are required')
    }

    // Prevent impersonating yourself
    if (body.target_person_id === ctx.personId) {
      return error('Cannot impersonate yourself')
    }

    // Verify target is a member of the target account
    const { data: membership } = await db
      .from('memberships')
      .select('account_role')
      .eq('person_id', body.target_person_id)
      .eq('account_id', body.target_account_id)
      .eq('status', 'active')
      .single()

    if (!membership) {
      return error('Target person is not an active member of the specified account', 404)
    }

    // End any existing active sessions for this admin
    await db
      .from('impersonation_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('admin_person_id', ctx.personId)
      .eq('status', 'active')

    // Create new session
    const { data: session, error: insertErr } = await db
      .from('impersonation_sessions')
      .insert({
        admin_person_id: ctx.personId,
        target_person_id: body.target_person_id,
        target_account_id: body.target_account_id,
        target_account_role: membership.account_role,
        reason: body.reason || null,
      })
      .select()
      .single()

    if (insertErr) return error(insertErr.message, 500)

    // Fetch target person + account info for the response
    const [{ data: targetPerson }, { data: targetAccount }] = await Promise.all([
      db.from('persons').select('id, full_name, email').eq('id', body.target_person_id).single(),
      db.from('accounts').select('id, display_name').eq('id', body.target_account_id).single(),
    ])

    // Audit
    await emitAudit(ctx, 'impersonation.started', 'impersonation_session', session.id, null, {
      admin_person_id: ctx.personId,
      target_person_id: body.target_person_id,
      target_account_id: body.target_account_id,
      target_role: membership.account_role,
      reason: body.reason,
    })

    await emitActivity(
      ctx,
      'impersonation.started',
      `Admin started impersonating ${targetPerson?.full_name} in ${targetAccount?.display_name}`,
      'impersonation_session',
      session.id,
      {
        target_person_id: body.target_person_id,
        target_account_id: body.target_account_id,
        reason: body.reason,
      },
    )

    console.log(`[impersonate] ${ctx.personId} → ${body.target_person_id} in ${body.target_account_id}`)

    return json({
      session: {
        ...session,
        target_person: targetPerson,
        target_account: targetAccount,
      },
    }, 201)
  },

  // DELETE: end impersonation
  async DELETE(req, ctx, params) {
    const authErr = requireAuth(ctx)
    if (authErr) return authErr
    const adminErr = requireSystemAdmin(ctx)
    if (adminErr) return adminErr

    const sessionId = params.get('session_id')

    if (sessionId) {
      // End specific session
      const { data: session } = await db
        .from('impersonation_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('admin_person_id', ctx.personId)
        .eq('status', 'active')
        .select()
        .single()

      if (!session) return error('Active session not found', 404)

      await emitAudit(ctx, 'impersonation.ended', 'impersonation_session', session.id, null, {
        admin_person_id: ctx.personId,
        target_person_id: session.target_person_id,
        duration_seconds: Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000),
      })

      await emitActivity(
        ctx,
        'impersonation.ended',
        `Admin ended impersonation session`,
        'impersonation_session',
        session.id,
      )

      return json({ ended: true })
    }

    // End all active sessions for this admin
    const { data: sessions } = await db
      .from('impersonation_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('admin_person_id', ctx.personId)
      .eq('status', 'active')
      .select()

    return json({ ended: true, count: sessions?.length ?? 0 })
  },
})
