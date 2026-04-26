import { createHandler } from './_shared/middleware'

// Get current user context (simplified auth model)
export const context = createHandler(async (ctx, _body) => {
  // Authentication is required
  if (!ctx.principal || ctx.principal.id === 'anonymous') {
    throw new Error('Authentication required')
  }

  console.log('Backend: Fetching user context for person:', ctx.principal.id)

  // Single query gets everything - person, account, role using simplified model
  const { data: personData, error: personError } = await ctx.db
    .from('people')
    .select(`
      id,
      email,
      full_name,
      avatar_url,
      account_id,
      role_id,
      account:accounts!people_account_id_fkey(
        id,
        slug,
        display_name,
        parent_id
      ),
      role:roles(
        id,
        slug,
        name,
        is_system
      )
    `)
    .eq('id', ctx.principal.id)
    .eq('is_active', true)
    .single()

  if (personError) {
    console.error('Backend: Error fetching person:', personError)
  }

  if (!personData) {
    throw new Error('User not found: ' + ctx.principal.id)
  }

  console.log('Backend: Person data found:', {
    id: personData.id,
    email: personData.email,
    account_id: personData.account_id,
    role_id: personData.role_id
  })

  // Extract account and role (handle array responses)
  const account = Array.isArray(personData.account) ? personData.account[0] : personData.account
  const role = Array.isArray(personData.role) ? personData.role[0] : personData.role

  // Get child accounts recursively
  let accessibleAccounts = []
  if (personData.account_id) {
    const { data: childAccounts } = await ctx.db
      .rpc('get_account_hierarchy', { 
        parent_account_id: personData.account_id 
      })
    
    accessibleAccounts = childAccounts || []
    console.log('Backend: Found', accessibleAccounts.length, 'accessible accounts')
  }

  // Determine permissions from role - system_admin role has full permissions
  let effectivePermissions = []
  const roleSlug = role?.slug
  
  if (roleSlug === 'system_admin') {
    effectivePermissions = ['read', 'write', 'admin', 'system']
  } else if (role?.permissions && Array.isArray(role.permissions)) {
    effectivePermissions = role.permissions
  }

  console.log('Backend: User context complete:', {
    id: personData.id,
    email: personData.email,
    account: account?.slug,
    role: roleSlug,
    permissionsCount: effectivePermissions.length
  })

  // Return complete user context
  // Note: system_admin status is determined by 'system_admin' in roles array
  return {
    id: personData.id,
    email: personData.email,
    full_name: personData.full_name,
    account_id: personData.account_id,
    account: account,
    roles: [roleSlug].filter(Boolean),
    permissions: effectivePermissions,
    accessible_accounts: accessibleAccounts
  }
})

// Health check for auth service
export const health = createHandler(async (ctx, _body) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'auth'
  }
})

// Main handler function for Netlify routing
export const handler = createHandler(async (ctx, _body) => {
  const method = ctx.query?.method || 'GET'

  switch (method) {
    case 'GET':
      // Default to context endpoint for GET requests
      return await context(ctx, _body)
    case 'HEALTH':
      return await health(ctx, _body)
    default:
      throw new Error(`Unsupported method: ${method}`)
  }
})
