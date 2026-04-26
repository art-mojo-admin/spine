import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// List person's accounts
export const listPersonAccounts = createHandler(async (ctx, body) => {
  const { person_id, include_inactive } = ctx.query || {}

  if (!person_id) {
    throw new Error('person_id is required')
  }

  const { data, error: err } = await db
    .rpc('get_person_accounts', {
      person_id,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// List account's people
export const listAccountPeople = createHandler(async (ctx, body) => {
  const { account_id, include_inactive } = ctx.query || {}

  if (!account_id) {
    throw new Error('account_id is required')
  }

  const { data, error: err } = await db
    .rpc('get_account_people', {
      account_id,
      include_inactive: include_inactive === 'true'
    })

  if (err) throw err

  return data
})

// Add person to account
export const addToAccount = requireAuth(createHandler(async (ctx, body) => {
  const { person_id, account_id, role_slug } = body

  if (!person_id || !account_id || !role_slug) {
    throw new Error('person_id, account_id, and role_slug are required')
  }

  const { data, error: err } = await db
    .rpc('add_person_to_account', {
      person_id,
      account_id,
      role_slug
    })

  if (err) throw err

  await emitLog(ctx, 'person_account.added', 
    { type: 'person_account', id: data }, 
    { after: { person_id, account_id, role_slug } }
  )

  return { membership_id: data }
}))

// Remove person from account
export const removeFromAccount = requireAuth(createHandler(async (ctx, body) => {
  const { person_id, account_id } = body

  if (!person_id || !account_id) {
    throw new Error('person_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('remove_person_from_account', {
      person_id,
      account_id
    })

  if (err) throw err

  await emitLog(ctx, 'person_account.removed', 
    { type: 'person_account', id: `${person_id}-${account_id}` }, 
    { before: { person_id, account_id } }
  )

  return { success: data }
}))

// Check if person is member of account
export const checkMembership = createHandler(async (ctx, body) => {
  const { person_id, account_id } = ctx.query || {}

  if (!person_id || !account_id) {
    throw new Error('person_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('is_account_member', {
      person_id,
      account_id
    })

  if (err) throw err

  return { is_member: data }
})

// Get membership details
export const getMembership = createHandler(async (ctx, body) => {
  const { person_id, account_id } = ctx.query || {}

  if (!person_id || !account_id) {
    throw new Error('person_id and account_id are required')
  }

  const { data, error: err } = await db
    .from('people_accounts')
    .select(`
      *,
      person:people(id, full_name, email),
      account:accounts(id, slug, display_name)
    `)
    .eq('person_id', person_id)
    .eq('account_id', account_id)
    .single()

  if (err) throw err

  return data
})

// Update membership
export const updateMembership = requireAuth(createHandler(async (ctx, body) => {
  const { person_id, account_id, role_slug, is_active } = body

  if (!person_id || !account_id) {
    throw new Error('person_id and account_id are required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('people_accounts')
    .select('*')
    .eq('person_id', person_id)
    .eq('account_id', account_id)
    .single()

  if (!current) {
    throw new Error('Membership not found')
  }

  const updates: any = {}
  if (role_slug !== undefined) updates.role_slug = role_slug
  if (is_active !== undefined) {
    updates.is_active = is_active
    if (!is_active) {
      updates.left_at = new Date().toISOString()
    } else {
      updates.left_at = null
    }
  }
  updates.updated_at = new Date().toISOString()

  const { data, error: err } = await db
    .from('people_accounts')
    .update(updates)
    .eq('person_id', person_id)
    .eq('account_id', account_id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'person_account.updated', 
    { type: 'person_account', id: `${person_id}-${account_id}` }, 
    { before: current, after: data }
  )

  return data
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'person-accounts':
      if (method === 'GET') {
        return await listPersonAccounts(ctx, body)
      }
      break
    case 'account-people':
      if (method === 'GET') {
        return await listAccountPeople(ctx, body)
      }
      break
    case 'add':
      if (method === 'POST') {
        return await addToAccount(ctx, body)
      }
      break
    case 'remove':
      if (method === 'DELETE') {
        return await removeFromAccount(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await checkMembership(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.person_id && ctx.query?.account_id) {
        return await getMembership(ctx, body)
      } else if (method === 'PATCH') {
        return await updateMembership(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
