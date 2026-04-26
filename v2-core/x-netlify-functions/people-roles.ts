import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List person's roles in account
export const listPersonRoles = createHandler(async (ctx, body) => {
  const { person_id, account_id, include_expired } = ctx.query || {}

  if (!person_id || !account_id) {
    throw new Error('person_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('get_person_roles', {
      person_id,
      account_id,
      include_expired: include_expired === 'true'
    })

  if (err) throw err

  return data
})

// List role members in account
export const listRoleMembers = createHandler(async (ctx, body) => {
  const { role_id, account_id, include_expired } = ctx.query || {}

  if (!role_id || !account_id) {
    throw new Error('role_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('get_role_members', {
      role_id,
      account_id,
      include_expired: include_expired === 'true'
    })

  if (err) throw err

  return data
})

// Grant role to person
export const grant = requireAuth(createHandler(async (ctx, body) => {
  const { person_id, account_id, role_id, expires_at } = body

  if (!person_id || !account_id || !role_id) {
    throw new Error('person_id, account_id, and role_id are required')
  }

  const { data, error: err } = await db
    .rpc('grant_role_to_person', {
      person_id,
      account_id,
      role_id,
      granted_by: ctx.personId,
      expires_at: expires_at || null
    })

  if (err) throw err

  await emitLog(ctx, 'person_role.granted', 
    { type: 'person_role', id: data }, 
    { after: { person_id, account_id, role_id, expires_at } }
  )

  return { assignment_id: data }
}))

// Revoke role from person
export const revoke = requireAuth(createHandler(async (ctx, body) => {
  const { person_id, account_id, role_id } = body

  if (!person_id || !account_id || !role_id) {
    throw new Error('person_id, account_id, and role_id are required')
  }

  const { data, error: err } = await db
    .rpc('revoke_role_from_person', {
      person_id,
      account_id,
      role_id
    })

  if (err) throw err

  await emitLog(ctx, 'person_role.revoked', 
    { type: 'person_role', id: `${person_id}-${account_id}-${role_id}` }, 
    { before: { person_id, account_id, role_id } }
  )

  return { success: data }
}))

// Check if person has role
export const checkRole = createHandler(async (ctx, body) => {
  const { person_id, account_id, role_slug } = ctx.query || {}

  if (!person_id || !account_id || !role_slug) {
    throw new Error('person_id, account_id, and role_slug are required')
  }

  const { data, error: err } = await db
    .rpc('person_has_role', {
      person_id,
      account_id,
      role_slug
    })

  if (err) throw err

  return { has_role: data }
})

// Get role assignment details
export const getAssignment = createHandler(async (ctx, body) => {
  const { person_id, account_id, role_id } = ctx.query || {}

  if (!person_id || !account_id || !role_id) {
    throw new Error('person_id, account_id, and role_id are required')
  }

  const { data, error: err } = await db
    .from('people_roles')
    .select(`
      *,
      person:people(id, full_name, email),
      account:accounts(id, slug, display_name),
      role:roles(id, slug, name, is_system)
    `)
    .eq('person_id', person_id)
    .eq('account_id', account_id)
    .eq('role_id', role_id)
    .single()

  if (err) throw err

  return data
})

// Update role assignment
export const updateAssignment = requireAuth(createHandler(async (ctx, body) => {
  const { person_id, account_id, role_id, expires_at, is_active } = body

  if (!person_id || !account_id || !role_id) {
    throw new Error('person_id, account_id, and role_id are required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('people_roles')
    .select('*')
    .eq('person_id', person_id)
    .eq('account_id', account_id)
    .eq('role_id', role_id)
    .single()

  if (!current) {
    throw new Error('Role assignment not found')
  }

  const updates: any = {}
  if (expires_at !== undefined) updates.expires_at = expires_at
  if (is_active !== undefined) updates.is_active = is_active
  updates.updated_at = new Date().toISOString()

  const { data, error: err } = await db
    .from('people_roles')
    .update(updates)
    .eq('person_id', person_id)
    .eq('account_id', account_id)
    .eq('role_id', role_id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'person_role.updated', 
    { type: 'person_role', id: `${person_id}-${account_id}-${role_id}` }, 
    { before: current, after: data }
  )

  return data
}))

// Resolve person permissions
export const resolvePermissions = createHandler(async (ctx, body) => {
  const { person_id, account_id } = ctx.query || {}

  if (!person_id || !account_id) {
    throw new Error('person_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('resolve_person_permissions', {
      person_id,
      account_id
    })

  if (err) throw err

  return data
})

// Cleanup expired roles (admin only)
export const cleanupExpired = requireAuth(createHandler(async (ctx, body) => {
  const { data, error: err } = await db
    .rpc('cleanup_expired_roles')

  if (err) throw err

  await emitLog(ctx, 'roles.cleanup', 
    { type: 'system', id: 'expired_roles' }, 
    { after: { cleaned_count: data } }
  )

  return { cleaned_count: data }
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'person-roles':
      if (method === 'GET') {
        return await listPersonRoles(ctx, body)
      }
      break
    case 'role-members':
      if (method === 'GET') {
        return await listRoleMembers(ctx, body)
      }
      break
    case 'grant':
      if (method === 'POST') {
        return await grant(ctx, body)
      }
      break
    case 'revoke':
      if (method === 'DELETE') {
        return await revoke(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await checkRole(ctx, body)
      }
      break
    case 'permissions':
      if (method === 'GET') {
        return await resolvePermissions(ctx, body)
      }
      break
    case 'cleanup':
      if (method === 'POST') {
        return await cleanupExpired(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.person_id && ctx.query?.account_id && ctx.query?.role_id) {
        return await getAssignment(ctx, body)
      } else if (method === 'PATCH') {
        return await updateAssignment(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
