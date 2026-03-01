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

    const { data: memberships } = await db
      .from('memberships')
      .select(`
        id, account_id, account_role, status, scope,
        accounts:account_id (
          id,
          display_name,
          account_type,
          status,
          settings,
          parent_account_id,
          slug,
          metadata
        )
      `)
      .eq('person_id', ctx.personId)
      .eq('status', 'active')

    return json({
      person,
      profile,
      memberships: (memberships || []).map((m: any) => ({
        id: m.id,
        account_id: m.account_id,
        account_role: m.account_role,
        status: m.status,
        scope: m.scope,
        account: m.accounts,
      })),
    })
  },
})
