/**
 * @module account-nodes
 * @audience core-contributor
 * @layer api-handler
 * @stability stable
 *
 * Account hierarchy traversal endpoint. Given a single `node_id`, returns
 * the target account record plus three relational views:
 * - **ancestors** — all nodes from root to this node (via `get_account_ancestors` RPC)
 * - **children** — direct active children ordered by `display_name`
 * - **descendants** — all active nodes in the subtree (via `get_account_descendants` RPC)
 *
 * **Routed by:** `GET /.netlify/functions/account-nodes`
 *
 * **Authorization:** Uses `ctx.db` (RLS-scoped). Only accounts visible to
 * the authenticated principal are returned. Inactive accounts are excluded
 * (`is_active = true` filter on node + children queries).
 *
 * **Response shape:**
 * ```ts
 * {
 *   node: Account & { type: TypeRecord }
 *   ancestors: AccountAncestorRow[]
 *   children: Array<Account & { type: TypeRecord }>
 *   descendants: AccountDescendantRow[]
 * }
 * ```
 *
 * @seeAlso auth.ts (context handler also calls get_account_hierarchy RPC)
 * @seeAlso accounts.ts (CRUD; creates the account nodes)
 * @seeAlso _shared/db.ts (get_account_ancestors / get_account_descendants RPCs)
 */

import { createHandler } from './_shared/middleware'

/**
 * Netlify function entry point. Returns the account node for `node_id` along
 * with its full ancestor chain, direct children, and all descendants.
 *
 * Query params: `node_id` (required, UUID)
 *
 * @returns `{ node, ancestors, children, descendants }`
 * @throws Error('node_id is required')
 * @throws Error('Account node not found') if node is missing or inactive
 * @throws PostgREST errors from get_account_ancestors / get_account_descendants RPCs
 * @sideEffects DB read: accounts table (node + children), get_account_ancestors RPC,
 *   get_account_descendants RPC
 * @calledBy Netlify function routing (GET)
 * @testUnit tests/unit/account-nodes.test.ts — 'returns node with hierarchy'
 */
export const handler = createHandler(async (ctx, body) => {
  const { node_id } = ctx.query || {}
  
  if (!node_id) {
    throw new Error('node_id is required')
  }

  // Get the account node
  const { data: node, error: nodeError } = await ctx.db
    .from('accounts')
    .select(`
      *,
      type:types(id, slug, name, icon, color)
    `)
    .eq('id', node_id)
    .eq('is_active', true)
    .single()

  if (nodeError || !node) {
    throw new Error('Account node not found')
  }

  // Get ancestors using the closure table
  const { data: ancestors, error: ancestorsError } = await ctx.db
    .rpc('get_account_ancestors', { account_id: node_id })

  if (ancestorsError) {
    throw ancestorsError
  }

  // Get children (direct descendants)
  const { data: children, error: childrenError } = await ctx.db
    .from('accounts')
    .select(`
      *,
      type:types(id, slug, name, icon, color)
    `)
    .eq('parent_id', node_id)
    .eq('is_active', true)
    .order('display_name')

  if (childrenError) {
    throw childrenError
  }

  // Get all descendants (optional, for tree view)
  const { data: descendants, error: descendantsError } = await ctx.db
    .rpc('get_account_descendants', { account_id: node_id })

  if (descendantsError) {
    throw descendantsError
  }

  return {
    node,
    ancestors: ancestors || [],
    children: children || [],
    descendants: descendants || []
  }
})
