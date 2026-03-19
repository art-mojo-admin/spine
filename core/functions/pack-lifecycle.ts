import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const packId = params.get('pack_id')
    const status = params.get('status')
    const mode = params.get('mode') as 'installed' | 'history' | 'dependencies' | 'overview'

    try {
      let result

      switch (mode) {
        case 'installed':
          result = await getInstalledPacks(ctx.accountId!, packId || undefined, status || undefined)
          break
        case 'history':
          result = await getPackHistory(ctx.accountId!, packId || '')
          break
        case 'dependencies':
          result = await getPackDependencies(ctx.accountId!, packId || '')
          break
        case 'overview':
        default:
          result = await getPackOverview(ctx.accountId!)
          break
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Pack lifecycle query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      pack_id: string
      version: string
      mode: 'install' | 'upgrade' | 'rollback' | 'uninstall'
      validate_dependencies?: boolean
    }>(req)

    if (!body.pack_id) return error('pack_id required')
    if (!body.version) return error('version required')
    if (!body.mode) return error('mode required')

    try {
      let result

      switch (body.mode) {
        case 'install':
          result = await installPack(ctx, body.pack_id, body.version, body.validate_dependencies !== false)
          break
        case 'upgrade':
          result = await upgradePack(ctx, body.pack_id, body.version, body.validate_dependencies !== false)
          break
        case 'rollback':
          result = await rollbackPack(ctx, body.pack_id, body.version)
          break
        case 'uninstall':
          result = await uninstallPack(ctx, body.pack_id)
          break
        default:
          throw new Error(`Unsupported mode: ${body.mode}`)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Pack operation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const installedPackId = params.get('installed_pack_id')
    if (!installedPackId) return error('installed_pack_id required')

    const body = await parseBody<{
      status?: 'pending' | 'installing' | 'installed' | 'failed' | 'upgrading' | 'uninstalling' | 'uninstalled'
      error_message?: string
      metadata?: Record<string, unknown>
    }>(req)

    try {
      const result = await updateInstalledPack(ctx, installedPackId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Pack update failed', 500)
    }
  },
})

async function getInstalledPacks(accountId: string, packId?: string, status?: string) {
  let query = db
    .from('pack_status_overview')
    .select('*')
    .eq('account_id', accountId)

  if (packId) query = query.eq('pack_id', packId)
  if (status) query = query.eq('install_status', status)

  const { data, error } = await query.order('installed_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getPackHistory(accountId: string, packId: string) {
  const { data, error } = await db
    .from('pack_install_history')
    .select(`
      *,
      config_packs:pack_id (
        name,
        display_name,
        description
      )
    `)
    .eq('account_id', accountId)
    .eq('pack_id', packId)
    .order('started_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getPackDependencies(accountId: string, packId: string) {
  const { data, error } = await db
    .from('pack_dependencies')
    .select(`
      *,
      dependency_pack:dependency_pack_id (
        name,
        display_name,
        description,
        category
      ),
      installed_pack:installed_pack_id (
        pack_version,
        install_status
      )
    `)
    .eq('account_id', accountId)
    .eq('installed_pack_id', packId)

  if (error) throw error
  return data || []
}

async function getPackOverview(accountId: string) {
  const { data, error } = await db
    .from('pack_status_overview')
    .select('*')
    .eq('account_id', accountId)
    .order('installed_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function installPack(ctx: any, packId: string, version: string, validateDeps: boolean) {
  // Check if pack exists
  const { data: pack } = await db
    .from('config_packs')
    .select('*')
    .eq('id', packId)
    .single()

  if (!pack) throw new Error('Pack not found')

  // Check if already installed
  const { data: existing } = await db
    .from('installed_packs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('pack_id', packId)
    .single()

  if (existing) throw new Error('Pack already installed')

  // Validate dependencies if requested
  if (validateDeps) {
    const { data: deps } = await db.rpc('check_pack_dependencies', {
      check_account_id: ctx.accountId,
      check_pack_id: packId,
      check_version: version
    })

    const unsatisfiedDeps = deps?.filter((d: any) => !d.satisfied) || []
    if (unsatisfiedDeps.length > 0) {
      throw new Error(`Unsatisfied dependencies: ${unsatisfiedDeps.map((d: any) => d.dependency_pack_name).join(', ')}`)
    }
  }

  // Initiate installation
  const { data: installedPack } = await db.rpc('initiate_pack_installation', {
    install_account_id: ctx.accountId,
    install_pack_id: packId,
    install_version: version,
    install_mode: 'install'
  })

  if (!installedPack) throw new Error('Failed to initiate installation')

  // Create rollback snapshot
  await createRollbackSnapshot(ctx.accountId, installedPack, 'pre_install', version, {})

  // Update status to installing
  await db
    .from('installed_packs')
    .update({ install_status: 'installing' })
    .eq('id', installedPack)

  await emitAudit(ctx, 'create', 'pack_installation', installedPack, null, { pack_id: packId, version })
  await emitActivity(ctx, 'pack.install.started', `Started installing ${pack.display_name}`, 'pack', packId)

  return {
    installed_pack_id: installedPack,
    pack_id: packId,
    version,
    status: 'installing',
    message: 'Installation initiated'
  }
}

async function upgradePack(ctx: any, packId: string, version: string, validateDeps: boolean) {
  // Check current installation
  const { data: current } = await db
    .from('installed_packs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('pack_id', packId)
    .single()

  if (!current) throw new Error('Pack not installed')
  if (current.pack_version === version) throw new Error('Already at specified version')

  // Validate dependencies
  if (validateDeps) {
    const { data: deps } = await db.rpc('check_pack_dependencies', {
      check_account_id: ctx.accountId,
      check_pack_id: packId,
      check_version: version
    })

    const unsatisfiedDeps = deps?.filter((d: any) => !d.satisfied) || []
    if (unsatisfiedDeps.length > 0) {
      throw new Error(`Unsatisfied dependencies: ${unsatisfiedDeps.map((d: any) => d.dependency_pack_name).join(', ')}`)
    }
  }

  // Initiate upgrade
  const { data: installedPack } = await db.rpc('initiate_pack_installation', {
    install_account_id: ctx.accountId,
    install_pack_id: packId,
    install_version: version,
    install_mode: 'upgrade'
  })

  if (!installedPack) throw new Error('Failed to initiate upgrade')

  // Create rollback snapshot
  await createRollbackSnapshot(ctx.accountId, installedPack, 'pre_upgrade', current.pack_version, {})

  // Update status to upgrading
  await db
    .from('installed_packs')
    .update({ install_status: 'upgrading' })
    .eq('id', installedPack)

  await emitAudit(ctx, 'update', 'pack_installation', installedPack, current, { pack_id: packId, version })
  await emitActivity(ctx, 'pack.upgrade.started', `Started upgrading pack`, 'pack', packId)

  return {
    installed_pack_id: installedPack,
    pack_id: packId,
    from_version: current.pack_version,
    to_version: version,
    status: 'upgrading',
    message: 'Upgrade initiated'
  }
}

async function rollbackPack(ctx: any, packId: string, version: string) {
  // Find rollback snapshot
  const { data: snapshot } = await db
    .from('pack_rollback_snapshots')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('installed_pack_id', packId)
    .eq('version', version)
    .eq('snapshot_type', 'pre_upgrade')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!snapshot) throw new Error('No rollback snapshot found for specified version')

  // Update status to rolling back
  await db
    .from('installed_packs')
    .update({ install_status: 'uninstalling' }) // Use uninstalling as rollback status
    .eq('id', packId)

  await emitAudit(ctx, 'update', 'pack_rollback', packId, null, { to_version: version })
  await emitActivity(ctx, 'pack.rollback.started', `Started rolling back to version ${version}`, 'pack', packId)

  return {
    installed_pack_id: packId,
    to_version: version,
    status: 'rolling_back',
    message: 'Rollback initiated'
  }
}

async function uninstallPack(ctx: any, packId: string) {
  // Check current installation
  const { data: current } = await db
    .from('installed_packs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('pack_id', packId)
    .single()

  if (!current) throw new Error('Pack not installed')

  // Create rollback snapshot
  await createRollbackSnapshot(ctx.accountId, packId, 'pre_uninstall', current.pack_version, {})

  // Update status to uninstalling
  await db
    .from('installed_packs')
    .update({ install_status: 'uninstalling' })
    .eq('id', packId)

  await emitAudit(ctx, 'delete', 'pack_installation', packId, current, null)
  await emitActivity(ctx, 'pack.uninstall.started', `Started uninstalling pack`, 'pack', packId)

  return {
    installed_pack_id: packId,
    status: 'uninstalling',
    message: 'Uninstall initiated'
  }
}

async function updateInstalledPack(ctx: any, installedPackId: string, updates: any) {
  const { data: before } = await db
    .from('installed_packs')
    .select('*')
    .eq('id', installedPackId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Installed pack not found')

  const updateData: Record<string, unknown> = {}
  if (updates.status) updateData.install_status = updates.status
  if (updates.error_message !== undefined) updateData.error_message = updates.error_message
  if (updates.metadata) updateData.metadata = updates.metadata

  const { data } = await db
    .from('installed_packs')
    .update(updateData)
    .eq('id', installedPackId)
    .eq('account_id', ctx.accountId)
    .select()
    .single()

  await emitAudit(ctx, 'update', 'installed_pack', installedPackId, before, data)

  return data
}

async function createRollbackSnapshot(accountId: string, installedPackId: string, snapshotType: string, version: string, snapshotData: any) {
  await db.rpc('create_pack_rollback_snapshot', {
    snapshot_account_id: accountId,
    snapshot_installed_pack_id: installedPackId,
    snapshot_type: snapshotType,
    snapshot_version: version,
    snapshot_data: snapshotData
  })
}
