import { createHandler, requireAuth, requireTenant, json, error } from './_shared/middleware'
import { db } from './_shared/db'

interface AccountSummary {
  id: string
  display_name: string
  account_type: string
  status: string
  slug: string | null
  parent_account_id: string | null
}

export default createHandler({
  async GET(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const params = new URL(req.url).searchParams
    const requestedId = params.get('node_id')

    let nodeId = requestedId || ctx.accountNodeId || ctx.accountId
    if (!nodeId) return error('No account context', 404)

    if (nodeId !== ctx.accountId) {
      const { data: allowed } = await db
        .from('account_paths')
        .select('ancestor_id')
        .eq('ancestor_id', ctx.accountId)
        .eq('descendant_id', nodeId)
        .single()

      if (!allowed) {
        nodeId = ctx.accountId
      }
    }

    const { data: node } = await db
      .from('accounts')
      .select('id, display_name, account_type, status, slug, parent_account_id, metadata')
      .eq('id', nodeId)
      .single()

    if (!node) return error('Node not found', 404)

    const { data: ancestorRows = [] } = await db
      .from('account_paths')
      .select(`
        depth,
        ancestor:accounts!account_paths_ancestor_id_fkey (
          id,
          display_name,
          account_type,
          status,
          slug,
          parent_account_id
        )
      `)
      .eq('descendant_id', nodeId)
      .gt('depth', 0)
      .order('depth', { ascending: true })

    const ancestors: AccountSummary[] = ancestorRows
      .map((row: any) => row.ancestor as AccountSummary | null)
      .filter((item): item is AccountSummary => !!item)

    const { data: children = [] } = await db
      .from('accounts')
      .select('id, display_name, account_type, status, slug, parent_account_id')
      .eq('parent_account_id', nodeId)
      .order('display_name', { ascending: true })

    return json({
      node,
      ancestors,
      children,
    })
  },
})
