import { createHandler, requireAuth, json, error } from './_shared/middleware'
import { db } from './_shared/db'

// Get account node with ancestors and children
export const handler = createHandler(async (ctx, body) => {
  const { node_id } = ctx.query || {}
  
  if (!node_id) {
    throw new Error('node_id is required')
  }

  // Get the account node
  const { data: node, error: nodeError } = await db
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
  const { data: ancestors, error: ancestorsError } = await db
    .rpc('get_account_ancestors', { account_id: node_id })

  if (ancestorsError) {
    throw ancestorsError
  }

  // Get children (direct descendants)
  const { data: children, error: childrenError } = await db
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
  const { data: descendants, error: descendantsError } = await db
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
