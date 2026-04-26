import { createHandler, requireAuth, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitLog } from './_shared/audit'

// Get account's active apps
export const getAccountApps = createHandler(async (ctx, body) => {
  const { account_id } = ctx.query || {}

  const targetAccountId = account_id || ctx.accountId

  if (!targetAccountId) {
    throw new Error('Account context required')
  }

  const { data, error: err } = await db
    .rpc('get_account_active_apps', {
      account_id: targetAccountId
    })

  if (err) throw err

  return data
})

// Get app's accounts
export const getAppAccounts = createHandler(async (ctx, body) => {
  const { app_id } = ctx.query || {}

  if (!app_id) {
    throw new Error('App ID is required')
  }

  const { data, error: err } = await db
    .rpc('get_app_accounts', {
      app_id
    })

  if (err) throw err

  return data
})

// Install app for account
export const install = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, account_id, config } = body

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('install_app_for_account', {
      app_id,
      account_id,
      config: config || {}
    })

  if (err) throw err

  await emitLog(ctx, 'app_account.installed', 
    { type: 'app_account', id: data }, 
    { after: { app_id, account_id, config } }
  )

  return { installation_id: data }
}))

// Activate app for account
export const activate = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, account_id } = body

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('activate_app_for_account', {
      app_id,
      account_id
    })

  if (err) throw err

  await emitLog(ctx, 'app_account.activated', 
    { type: 'app_account', id: `${app_id}-${account_id}` }, 
    { after: { app_id, account_id } }
  )

  return { success: data }
}))

// Deactivate app for account
export const deactivate = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, account_id } = body

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('deactivate_app_for_account', {
      app_id,
      account_id
    })

  if (err) throw err

  await emitLog(ctx, 'app_account.deactivated', 
    { type: 'app_account', id: `${app_id}-${account_id}` }, 
    { after: { app_id, account_id } }
  )

  return { success: data }
}))

// Uninstall app from account
export const uninstall = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, account_id } = body

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('uninstall_app_from_account', {
      app_id,
      account_id
    })

  if (err) throw err

  await emitLog(ctx, 'app_account.uninstalled', 
    { type: 'app_account', id: `${app_id}-${account_id}` }, 
    { after: { app_id, account_id } }
  )

  return { success: data }
}))

// Check if app is active for account
export const checkActive = createHandler(async (ctx, body) => {
  const { app_id, account_id } = ctx.query || {}

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  const { data, error: err } = await db
    .rpc('is_app_active_for_account', {
      app_id,
      account_id
    })

  if (err) throw err

  return { is_active: data }
})

// Get installation details
export const getInstallation = createHandler(async (ctx, body) => {
  const { app_id, account_id } = ctx.query || {}

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  const { data, error: err } = await db
    .from('apps_accounts')
    .select(`
      *,
      app:apps(id, slug, name, icon, color),
      account:accounts(id, slug, display_name)
    `)
    .eq('app_id', app_id)
    .eq('account_id', account_id)
    .single()

  if (err) throw err

  return data
})

// Update installation
export const updateInstallation = requireAuth(createHandler(async (ctx, body) => {
  const { app_id, account_id, config, status } = body

  if (!app_id || !account_id) {
    throw new Error('app_id and account_id are required')
  }

  // Get current state for audit
  const { data: current } = await db
    .from('apps_accounts')
    .select('*')
    .eq('app_id', app_id)
    .eq('account_id', account_id)
    .single()

  if (!current) {
    throw new Error('Installation not found')
  }

  const updates: any = {}
  if (config !== undefined) updates.config = config
  if (status !== undefined) {
    updates.status = status
    if (status === 'activated' && current.status !== 'activated') {
      updates.activated_at = new Date().toISOString()
      updates.deactivated_at = null
    } else if (status === 'deactivated' && current.status === 'activated') {
      updates.deactivated_at = new Date().toISOString()
    } else if (status === 'uninstalled') {
      updates.uninstalled_at = new Date().toISOString()
    }
  }
  updates.updated_at = new Date().toISOString()

  const { data, error: err } = await db
    .from('apps_accounts')
    .update(updates)
    .eq('app_id', app_id)
    .eq('account_id', account_id)
    .select()
    .single()

  if (err) throw err

  await emitLog(ctx, 'app_account.updated', 
    { type: 'app_account', id: `${app_id}-${account_id}` }, 
    { before: current, after: data }
  )

  return data
}))

// Main handler function
export const handler = createHandler(async (ctx, body) => {
  const { action } = ctx.query || {}
  const method = ctx.query?.method || 'GET'

  switch (action) {
    case 'account-apps':
      if (method === 'GET') {
        return await getAccountApps(ctx, body)
      }
      break
    case 'app-accounts':
      if (method === 'GET') {
        return await getAppAccounts(ctx, body)
      }
      break
    case 'install':
      if (method === 'POST') {
        return await install(ctx, body)
      }
      break
    case 'activate':
      if (method === 'POST') {
        return await activate(ctx, body)
      }
      break
    case 'deactivate':
      if (method === 'POST') {
        return await deactivate(ctx, body)
      }
      break
    case 'uninstall':
      if (method === 'POST') {
        return await uninstall(ctx, body)
      }
      break
    case 'check':
      if (method === 'GET') {
        return await checkActive(ctx, body)
      }
      break
    default:
      if (method === 'GET' && ctx.query?.app_id && ctx.query?.account_id) {
        return await getInstallation(ctx, body)
      } else if (method === 'PATCH') {
        return await updateInstallation(ctx, body)
      }
  }

  throw new Error('Invalid action or method')
})
