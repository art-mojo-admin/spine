import { createHandler, requireAuth, json, error } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const { data: person } = await db
      .from('persons')
      .select('id, email, full_name, status')
      .eq('id', ctx.personId)
      .single()

    if (!person) return error('Person not found', 404)

    const { data: profile } = await db
      .from('profiles')
      .select('id, person_id, display_name, avatar_url, system_role')
      .eq('person_id', ctx.personId)
      .single()

    // NOTE: account_role column was dropped (migration drop_account_role_column)
    // Role is now derived from principal_scopes
    const { data: memberships } = await db
      .from('memberships')
      .select(`
        id, account_id, status,
        accounts:account_id (
          id,
          display_name,
          account_type,
          status,
          settings,
          slug,
          metadata
        )
      `)
      .eq('person_id', ctx.personId)
      .eq('status', 'active')

    // Derive per-account role from principal_scopes
    const { data: principalScopes } = await db
      .from('principal_scopes')
      .select('account_id, scope_id, auth_scopes:scope_id(slug, category)')
      .eq('person_id', ctx.personId)

    const roleByAccount: Record<string, string> = {}
    for (const ps of (principalScopes || [])) {
      const scope = ps.auth_scopes as any
      if (!scope) continue
      const acctId = ps.account_id
      const current = roleByAccount[acctId]
      // admin.* scopes → admin, operator.* → operator, else member
      if (scope.slug?.startsWith('admin.') || scope.category === 'admin') {
        roleByAccount[acctId] = 'admin'
      } else if (scope.slug?.startsWith('operator.') || scope.category === 'operator') {
        if (current !== 'admin') roleByAccount[acctId] = 'operator'
      } else {
        if (!current) roleByAccount[acctId] = 'member'
      }
    }

    return json({
      person,
      profile,
      memberships: (memberships || []).map((m: any) => ({
        id: m.id,
        account_id: m.account_id,
        account_role: roleByAccount[m.account_id] ?? 'member',
        status: m.status,
        account: m.accounts,
      })),
    })
  },
})
