import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const mode = params.get('mode') as 'overview' | 'lifecycle' | 'history' | 'dependencies' | 'manifests'
    const packId = params.get('pack_id')
    const status = params.get('status')

    try {
      let result

      switch (mode) {
        case 'overview':
          result = await getPackOverview(ctx.accountId!, status || undefined)
          break
        case 'lifecycle':
          result = await getPackLifecycle(ctx.accountId!, packId || undefined)
          break
        case 'history':
          result = await getPackHistory(ctx.accountId!, packId || '')
          break
        case 'dependencies':
          result = await getPackDependencies(ctx.accountId!, packId || '')
          break
        case 'manifests':
          result = await getPackManifests(ctx.accountId!)
          break
        default:
          result = await getPackOverview(ctx.accountId!, status || undefined)
          break
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Admin packs query failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<{
      pack_id: string
      version: string
      mode: 'install' | 'upgrade' | 'rollback' | 'uninstall'
      validate_dependencies?: boolean
      force?: boolean
    }>(req)

    if (!body.pack_id) return error('pack_id required')
    if (!body.version) return error('version required')
    if (!body.mode) return error('mode required')

    try {
      const result = await executePackOperation(ctx, body)
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
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
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

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
    if (roleCheck) return roleCheck

    const installedPackId = params.get('installed_pack_id')
    if (!installedPackId) return error('installed_pack_id required')

    try {
      await forceUninstallPack(ctx, installedPackId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Pack force uninstall failed', 500)
    }
  },
})

async function getPackOverview(accountId: string, status?: string) {
  const { data } = await db
    .from('admin_pack_lifecycle_summary')
    .select('*')
    .eq('account_id', accountId)
        .order('installed_at', { ascending: false })

  return data || []
}

async function getPackLifecycle(accountId: string, packId?: string) {
  let query = db
    .from('pack_status_overview')
    .select('*')
    .eq('account_id', accountId)

  if (packId) query = query.eq('pack_id', packId)

  const { data, error } = await query.order('installed_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getPackHistory(accountId: string, packId: string) {
  const { data } = await db
    .from('pack_install_history')
    .select(`
      *,
      config_packs:pack_id (
        name,
        display_name,
        description,
        category
      )
    `)
    .eq('account_id', accountId)
    .eq('pack_id', packId)
    .order('started_at', { ascending: false })

  return data || []
}

async function getPackDependencies(accountId: string, packId: string) {
  const { data } = await db
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

  return data || []
}

async function getPackManifests(accountId: string) {
  const { data } = await db
    .from('local_manifest_overview')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  return data || []
}

async function executePackOperation(ctx: any, body: any) {
  // Check if operation is allowed
  if (body.mode === 'install' || body.mode === 'upgrade') {
    const { data: existing } = await db
      .from('installed_packs')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('pack_id', body.pack_id)
      .single()

    if (existing && body.mode === 'install') {
      throw new Error('Pack already installed. Use upgrade mode instead.')
    }

    if (!existing && body.mode === 'upgrade') {
      throw new Error('Pack not installed. Use install mode first.')
    }
  }

  // Validate dependencies if requested
  if (body.validate_dependencies && !body.force) {
    const { data: deps } = await db.rpc('check_pack_dependencies', {
      check_account_id: ctx.accountId,
      check_pack_id: body.pack_id,
      check_version: body.version
    })

    const unsatisfiedDeps = deps?.filter((d: any) => !d.satisfied) || []
    if (unsatisfiedDeps.length > 0) {
      throw new Error(`Unsatisfied dependencies: ${unsatisfiedDeps.map((d: any) => d.dependency_pack_name).join(', ')}`)
    }
  }

  // Execute operation
  switch (body.mode) {
    case 'install':
      return await installPack(ctx, body)
    case 'upgrade':
      return await upgradePack(ctx, body)
    case 'rollback':
      return await rollbackPack(ctx, body)
    case 'uninstall':
      return await uninstallPack(ctx, body)
    default:
      throw new Error(`Unsupported operation: ${body.mode}`)
  }
}

async function installPack(ctx: any, body: any) {
  // Get pack details
  const { data: pack } = await db
    .from('config_packs')
    .select('*')
    .eq('id', body.pack_id)
    .single()

  if (!pack) throw new Error('Pack not found')

  // Initiate installation
  const { data: installedPack } = await db.rpc('initiate_pack_installation', {
    install_account_id: ctx.accountId,
    install_pack_id: body.pack_id,
    install_version: body.version,
    install_mode: 'install'
  })

  if (!installedPack) throw new Error('Failed to initiate installation')

  // Create rollback snapshot
  await db.rpc('create_pack_rollback_snapshot', {
    snapshot_account_id: ctx.accountId,
    snapshot_installed_pack_id: installedPack,
    snapshot_type: 'pre_install',
    snapshot_version: body.version,
    snapshot_data: {}
  })

  // Update status to installing
  await db
    .from('installed_packs')
    .update({ install_status: 'installing' })
    .eq('id', installedPack)

  // Create admin alert
  await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: 'pack',
    alert_severity: 'info',
    alert_title: `Pack installation started: ${pack.name}`,
    alert_message: `Installing version ${body.version}`,
    alert_data: { pack_id: body.pack_id, version: body.version, operation: 'install' },
    source_entity_type: 'installed_pack',
    source_entity_id: installedPack
  })

  await emitAudit(ctx, 'create', 'pack_installation', installedPack, null, body)
  await emitActivity(ctx, 'pack.install.started', `Started installing ${pack.name}`, 'pack', body.pack_id)

  return {
    installed_pack_id: installedPack,
    pack_id: body.pack_id,
    version: body.version,
    status: 'installing',
    message: 'Pack installation initiated'
  }
}

async function upgradePack(ctx: any, body: any) {
  // Get current installation
  const { data: current } = await db
    .from('installed_packs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('pack_id', body.pack_id)
    .single()

  if (!current) throw new Error('Pack not installed')
  if (current.pack_version === body.version) throw new Error('Already at specified version')

  // Get pack details
  const { data: pack } = await db
    .from('config_packs')
    .select('*')
    .eq('id', body.pack_id)
    .single()

  // Initiate upgrade
  const { data: installedPack } = await db.rpc('initiate_pack_installation', {
    install_account_id: ctx.accountId,
    install_pack_id: body.pack_id,
    install_version: body.version,
    install_mode: 'upgrade'
  })

  if (!installedPack) throw new Error('Failed to initiate upgrade')

  // Create rollback snapshot
  await db.rpc('create_pack_rollback_snapshot', {
    snapshot_account_id: ctx.accountId,
    snapshot_installed_pack_id: installedPack,
    snapshot_type: 'pre_upgrade',
    snapshot_version: current.pack_version,
    snapshot_data: {}
  })

  // Update status to upgrading
  await db
    .from('installed_packs')
    .update({ install_status: 'upgrading' })
    .eq('id', installedPack)

  // Create admin alert
  await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: 'pack',
    alert_severity: 'info',
    alert_title: `Pack upgrade started: ${pack.name}`,
    alert_message: `Upgrading from ${current.pack_version} to ${body.version}`,
    alert_data: { pack_id: body.pack_id, from_version: current.pack_version, to_version: body.version, operation: 'upgrade' },
    source_entity_type: 'installed_pack',
    source_entity_id: installedPack
  })

  await emitAudit(ctx, 'update', 'pack_installation', installedPack, current, { version: body.version })
  await emitActivity(ctx, 'pack.upgrade.started', `Started upgrading ${pack.name}`, 'pack', body.pack_id)

  return {
    installed_pack_id: installedPack,
    pack_id: body.pack_id,
    from_version: current.pack_version,
    to_version: body.version,
    status: 'upgrading',
    message: 'Pack upgrade initiated'
  }
}

async function rollbackPack(ctx: any, body: any) {
  // Find rollback snapshot
  const { data: snapshot } = await db
    .from('pack_rollback_snapshots')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('version', body.version)
    .eq('snapshot_type', 'pre_upgrade')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!snapshot) throw new Error('No rollback snapshot found for specified version')

  // Get current installation
  const { data: current } = await db
    .from('installed_packs')
    .select('*')
    .eq('id', body.pack_id)
    .single()

  if (!current) throw new Error('Pack installation not found')

  // Update status to rolling back
  await db
    .from('installed_packs')
    .update({ install_status: 'uninstalling' })
    .eq('id', body.pack_id)

  // Create admin alert
  await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: 'pack',
    alert_severity: 'warning',
    alert_title: `Pack rollback started`,
    alert_message: `Rolling back to version ${body.version}`,
    alert_data: { pack_id: current.pack_id, to_version: body.version, operation: 'rollback' },
    source_entity_type: 'installed_pack',
    source_entity_id: body.pack_id
  })

  await emitAudit(ctx, 'update', 'pack_rollback', body.pack_id, current, { to_version: body.version })
  await emitActivity(ctx, 'pack.rollback.started', `Started rolling back to version ${body.version}`, 'pack', current.pack_id)

  return {
    installed_pack_id: body.pack_id,
    to_version: body.version,
    status: 'rolling_back',
    message: 'Rollback initiated'
  }
}

async function uninstallPack(ctx: any, body: any) {
  // Get current installation
  const { data: current } = await db
    .from('installed_packs')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('pack_id', body.pack_id)
    .single()

  if (!current) throw new Error('Pack not installed')

  // Create rollback snapshot
  await db.rpc('create_pack_rollback_snapshot', {
    snapshot_account_id: ctx.accountId,
    snapshot_installed_pack_id: current.id,
    snapshot_type: 'pre_uninstall',
    snapshot_version: current.pack_version,
    snapshot_data: {}
  })

  // Update status to uninstalling
  await db
    .from('installed_packs')
    .update({ install_status: 'uninstalling' })
    .eq('id', current.id)

  // Create admin alert
  await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: 'pack',
    alert_severity: 'warning',
    alert_title: `Pack uninstall started`,
    alert_message: `Uninstalling pack version ${current.pack_version}`,
    alert_data: { pack_id: body.pack_id, version: current.pack_version, operation: 'uninstall' },
    source_entity_type: 'installed_pack',
    source_entity_id: current.id
  })

  await emitAudit(ctx, 'delete', 'pack_installation', current.id, current, null)
  await emitActivity(ctx, 'pack.uninstall.started', `Started uninstalling pack`, 'pack', body.pack_id)

  return {
    installed_pack_id: current.id,
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

  if (!data) throw new Error('Failed to update installed pack')

  // Create completion alert if status changed to terminal state
  if (updates.status && ['installed', 'failed', 'uninstalled'].includes(updates.status)) {
    const severity = updates.status === 'failed' ? 'error' : 'success'
    const alertType = updates.status === 'failed' ? 'error' : 'info'
    
    await db.rpc('create_admin_alert', {
      alert_account_id: ctx.accountId,
      alert_type: alertType,
      alert_severity: severity,
      alert_title: `Pack operation ${updates.status}`,
      alert_message: updates.error_message || `Pack operation completed with status: ${updates.status}`,
      alert_data: { pack_id: data.pack_id, status: updates.status },
      source_entity_type: 'installed_pack',
      source_entity_id: installedPackId
    })
  }

  await emitAudit(ctx, 'update', 'installed_pack', installedPackId, before, data)
  await emitActivity(ctx, 'installed_pack.updated', `Updated pack status to ${updates.status}`, 'installed_pack', installedPackId)

  return data
}

async function forceUninstallPack(ctx: any, installedPackId: string) {
  const { data: before } = await db
    .from('installed_packs')
    .select('*')
    .eq('id', installedPackId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Installed pack not found')

  // Force delete regardless of status
  const { error } = await db
    .from('installed_packs')
    .delete()
    .eq('id', installedPackId)
    .eq('account_id', ctx.accountId)

  if (error) throw error

  // Create admin alert
  await db.rpc('create_admin_alert', {
    alert_account_id: ctx.accountId,
    alert_type: 'pack',
    alert_severity: 'warning',
    alert_title: `Pack force uninstalled`,
    alert_message: `Pack ${before.pack_id} was force uninstalled by admin`,
    alert_data: { pack_id: before.pack_id, version: before.pack_version, operation: 'force_uninstall' },
    source_entity_type: 'installed_pack',
    source_entity_id: installedPackId
  })

  await emitAudit(ctx, 'delete', 'installed_pack', installedPackId, before, null)
  await emitActivity(ctx, 'installed_pack.force_uninstalled', `Force uninstalled pack`, 'installed_pack', installedPackId)
}

export async function getPackHealthMetrics(ctx: any) {
  const { data } = await db
    .from('admin_pack_lifecycle_summary')
    .select(`
      install_status,
      COUNT(*) as count,
      pack_category
    `)
    .eq('account_id', ctx.accountId)
    
  return data || []
}

export async function getPackDependencyGraph(ctx: any) {
  const { data } = await db
    .from('pack_dependencies')
    .select(`
      installed_pack_id,
      dependency_pack_id,
      dependency_type,
      version_constraint,
      satisfied,
      dependency_pack:dependency_pack_id (
        name,
        display_name,
        category
      ),
      installed_pack:installed_pack_id (
        pack_version,
        install_status
      )
    `)
    .eq('account_id', ctx.accountId)

  return data || []
}
