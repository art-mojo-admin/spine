import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async POST(req, ctx) {
    if (!ctx.authUid) return error('Authentication required', 401)

    // Check if person already exists
    const { data: existing } = await db
      .from('persons')
      .select('id')
      .eq('auth_uid', ctx.authUid)
      .single()

    if (existing) {
      return json({ already_provisioned: true, person_id: existing.id })
    }

    // Get user email from Supabase Auth
    const { data: { user } } = await db.auth.admin.getUserById(ctx.authUid)
    if (!user) return error('Auth user not found', 404)

    // Require email verification before provisioning
    if (!user.email_confirmed_at) {
      return error('Email not verified. Please confirm your email before continuing.', 403)
    }

    const email = user.email || ''
    const fullName = user.user_metadata?.full_name || email.split('@')[0] || 'User'

    const body = await parseBody<{ invite_token?: string; account_slug?: string }>(req).catch(() => ({} as { invite_token?: string; account_slug?: string }))
    const inviteToken = body.invite_token
    const accountSlug = body.account_slug

    if (accountSlug) {
      // === PORTAL SIGNUP PATH ===
      const { data: targetAccount } = await db
        .from('accounts')
        .select('id, display_name')
        .eq('slug', accountSlug)
        .eq('status', 'active')
        .single()

      if (!targetAccount) return error('Account not found', 404)

      // Create person
      const { data: person, error: personErr } = await db
        .from('persons')
        .insert({ auth_uid: ctx.authUid, email, full_name: fullName, status: 'active' })
        .select()
        .single()

      if (personErr) return error(personErr.message, 500)

      // Create profile
      await db.from('profiles').insert({
        person_id: person.id,
        display_name: fullName,
        system_role: null,
      })

      // Create membership as portal user
      await db.from('memberships').insert({
        person_id: person.id,
        account_id: targetAccount.id,
        account_role: 'portal',
        status: 'active',
      })

      const auditCtx = {
        requestId: ctx.requestId,
        personId: person.id,
        accountId: targetAccount.id,
        accountRole: 'portal',
        systemRole: null,
        authUid: ctx.authUid,
      }

      await emitAudit(auditCtx, 'create', 'person', person.id, null, person)
      await emitActivity(auditCtx, 'person.provisioned', `Portal user "${fullName}" joined "${targetAccount.display_name}"`, 'person', person.id)

      return json({ provisioned: true, person_id: person.id, account_id: targetAccount.id, path: 'portal' }, 201)

    } else if (inviteToken) {
      // === INVITED PATH ===
      const { data: invite } = await db
        .from('invites')
        .select('*')
        .eq('token', inviteToken)
        .eq('status', 'pending')
        .single()

      if (!invite) return error('Invalid or expired invite', 400)

      // Check expiry
      if (new Date(invite.expires_at) < new Date()) {
        await db.from('invites').update({ status: 'expired' }).eq('id', invite.id)
        return error('Invite has expired', 400)
      }

      // Check email matches
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        return error('Email does not match invite', 400)
      }

      // Create person
      const { data: person, error: personErr } = await db
        .from('persons')
        .insert({ auth_uid: ctx.authUid, email, full_name: fullName, status: 'active' })
        .select()
        .single()

      if (personErr) return error(personErr.message, 500)

      // Create profile
      await db.from('profiles').insert({
        person_id: person.id,
        display_name: fullName,
        system_role: null,
      })

      // Create membership to the inviter's account
      await db.from('memberships').insert({
        person_id: person.id,
        account_id: invite.account_id,
        account_role: invite.account_role,
        status: 'active',
      })

      // Mark invite as accepted
      await db.from('invites').update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      }).eq('id', invite.id)

      // Build a minimal context for audit
      const auditCtx = {
        requestId: ctx.requestId,
        personId: person.id,
        accountId: invite.account_id,
        accountRole: invite.account_role,
        systemRole: null,
        authUid: ctx.authUid,
      }

      await emitAudit(auditCtx, 'create', 'person', person.id, null, person)
      await emitActivity(auditCtx, 'person.provisioned', `User "${fullName}" joined via invite`, 'person', person.id)

      return json({ provisioned: true, person_id: person.id, account_id: invite.account_id, path: 'invited' }, 201)

    } else {
      // === DIRECT SIGNUP PATH ===
      // Create person
      const { data: person, error: personErr } = await db
        .from('persons')
        .insert({ auth_uid: ctx.authUid, email, full_name: fullName, status: 'active' })
        .select()
        .single()

      if (personErr) return error(personErr.message, 500)

      // Create profile
      await db.from('profiles').insert({
        person_id: person.id,
        display_name: fullName,
        system_role: null,
      })

      // Create individual account
      const { data: account, error: accountErr } = await db
        .from('accounts')
        .insert({
          account_type: 'individual',
          display_name: `${fullName}'s Account`,
          status: 'active',
          settings: {},
        })
        .select()
        .single()

      if (accountErr) return error(accountErr.message, 500)

      // Create membership as admin of own account
      await db.from('memberships').insert({
        person_id: person.id,
        account_id: account.id,
        account_role: 'admin',
        status: 'active',
      })

      // Create default theme
      await db.from('tenant_themes').insert({
        account_id: account.id,
        preset: 'clean',
        tokens: {},
      })

      const auditCtx = {
        requestId: ctx.requestId,
        personId: person.id,
        accountId: account.id,
        accountRole: 'admin',
        systemRole: null,
        authUid: ctx.authUid,
      }

      await emitAudit(auditCtx, 'create', 'person', person.id, null, person)
      await emitAudit(auditCtx, 'create', 'account', account.id, null, account)
      await emitActivity(auditCtx, 'person.provisioned', `User "${fullName}" signed up`, 'person', person.id)
      await emitActivity(auditCtx, 'account.created', `Account "${account.display_name}" created`, 'account', account.id)

      return json({ provisioned: true, person_id: person.id, account_id: account.id, path: 'direct' }, 201)
    }
  },
})
