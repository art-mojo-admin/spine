import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit, emitActivity } from './_shared/audit'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const manifestId = params.get('manifest_id')
    const status = params.get('status')
    const mode = params.get('mode') as 'overview' | 'validation' | 'assets'

    try {
      let result

      switch (mode) {
        case 'validation':
          result = await getManifestValidation(ctx.accountId!, manifestId || undefined)
          break
        case 'assets':
          result = await getManifestAssets(ctx.accountId!, manifestId || undefined)
          break
        case 'overview':
        default:
          result = await getManifestOverview(ctx.accountId!, manifestId || undefined, status || undefined)
          break
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Manifest query failed', 500)
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
      pack_id?: string
      manifest_name: string
      manifest_content: Record<string, unknown>
      manifest_schema?: Record<string, unknown>
      dependencies?: Array<Record<string, unknown>>
      validate_before_create?: boolean
    }>(req)

    if (!body.manifest_name) return error('manifest_name required')
    if (!body.manifest_content) return error('manifest_content required')

    try {
      const result = await createManifest(ctx, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Manifest creation failed', 500)
    }
  },

  async PATCH(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const manifestId = params.get('manifest_id')
    if (!manifestId) return error('manifest_id required')

    const body = await parseBody<{
      manifest_content?: Record<string, unknown>
      manifest_schema?: Record<string, unknown>
      dependencies?: Array<Record<string, unknown>>
      status?: 'draft' | 'validated' | 'published' | 'deprecated'
    }>(req)

    try {
      const result = await updateManifest(ctx, manifestId, body)
      return json(result)
    } catch (err: any) {
      return error(err.message || 'Manifest update failed', 500)
    }
  },

  async DELETE(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin', 'operator'])
    if (roleCheck) return roleCheck

    const manifestId = params.get('manifest_id')
    if (!manifestId) return error('manifest_id required')

    try {
      await deleteManifest(ctx, manifestId)
      return json({ success: true })
    } catch (err: any) {
      return error(err.message || 'Manifest deletion failed', 500)
    }
  },
})

async function getManifestOverview(accountId: string, manifestId?: string, status?: string) {
  let query = db
    .from('local_manifest_overview')
    .select('*')
    .eq('account_id', accountId)

  if (manifestId) query = query.eq('id', manifestId)
  if (status) query = query.eq('manifest_status', status)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getManifestValidation(accountId: string, manifestId?: string) {
  let query = db
    .from('manifest_validation_results')
    .select(`
      *,
      local_pack_manifests:manifest_id (
        manifest_name,
        manifest_version,
        manifest_status
      )
    `)
    .eq('manifest_id', manifestId)
    .order('validated_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return data || []
}

async function getManifestAssets(accountId: string, manifestId?: string) {
  let query = db
    .from('manifest_assets')
    .select('*')
    .eq('manifest_id', manifestId)
    .order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) throw error
  return data || []
}

async function createManifest(ctx: any, body: any) {
  // Resolve creating principal
  const { data: principal } = await db
    .from('principals')
    .select('id')
    .eq('person_id', ctx.personId)
    .single()

  // Create manifest
  const { data: manifest } = await db.rpc('create_local_manifest', {
    manifest_account_id: ctx.accountId,
    manifest_pack_id: body.pack_id || null,
    manifest_name: body.manifest_name,
    manifest_content: body.manifest_content,
    manifest_schema: body.manifest_schema || {},
    dependencies: body.dependencies || [],
    created_by_principal_id: principal?.id
  })

  if (!manifest) throw new Error('Failed to create manifest')

  // Validate if requested
  if (body.validate_before_create) {
    await validateManifest(manifest)
  }

  await emitAudit(ctx, 'create', 'local_manifest', manifest, null, body)
  await emitActivity(ctx, 'manifest.created', `Created manifest ${body.manifest_name}`, 'manifest', manifest)

  return {
    manifest_id: manifest,
    manifest_name: body.manifest_name,
    status: 'draft',
    message: 'Manifest created successfully'
  }
}

async function updateManifest(ctx: any, manifestId: string, updates: any) {
  const { data: before } = await db
    .from('local_pack_manifests')
    .select('*')
    .eq('id', manifestId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Manifest not found')

  const updateData: Record<string, unknown> = {}
  if (updates.manifest_content) updateData.manifest_content = updates.manifest_content
  if (updates.manifest_schema) updateData.manifest_schema = updates.manifest_schema
  if (updates.dependencies) updateData.dependencies = updates.dependencies
  if (updates.status) updateData.manifest_status = updates.status

  // Recalculate checksum if content changed
  if (updates.manifest_content || updates.manifest_schema || updates.dependencies) {
    const content = updates.manifest_content || before.manifest_content
    const schema = updates.manifest_schema || before.manifest_schema
    const dependencies = updates.dependencies || before.dependencies

    const { data: checksumResult } = await db.rpc('calculate_manifest_checksum', {
      manifest_content: content,
      manifest_schema: schema,
      dependencies: dependencies
    })

    updateData.checksum = checksumResult
  }

  const { data } = await db
    .from('local_pack_manifests')
    .update(updateData)
    .eq('id', manifestId)
    .eq('account_id', ctx.accountId)
    .select()
    .single()

  await emitAudit(ctx, 'update', 'local_manifest', manifestId, before, data)
  await emitActivity(ctx, 'manifest.updated', `Updated manifest ${data.manifest_name}`, 'manifest', manifestId)

  return data
}

async function deleteManifest(ctx: any, manifestId: string) {
  const { data: before } = await db
    .from('local_pack_manifests')
    .select('*')
    .eq('id', manifestId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!before) throw new Error('Manifest not found')

  // Check if manifest is published
  if (before.manifest_status === 'published') {
    throw new Error('Cannot delete published manifest. Deprecate it first.')
  }

  const { error } = await db
    .from('local_pack_manifests')
    .delete()
    .eq('id', manifestId)
    .eq('account_id', ctx.accountId)

  if (error) throw error

  await emitAudit(ctx, 'delete', 'local_manifest', manifestId, before, null)
  await emitActivity(ctx, 'manifest.deleted', `Deleted manifest ${before.manifest_name}`, 'manifest', manifestId)
}

async function validateManifest(manifestId: string) {
  try {
    // Run schema validation
    const { data: schemaValidation } = await db.rpc('validate_manifest_schema', {
      validate_manifest_id: manifestId
    })

    // Store validation results
    for (const result of schemaValidation || []) {
      await db
        .from('manifest_validation_results')
        .insert({
          manifest_id: manifestId,
          validation_type: result.validation_type,
          validation_status: result.validation_status,
          validation_score: result.validation_score,
          validation_details: result.validation_details,
          error_messages: result.error_messages
        })
    }

    // Run dependency validation
    const { data: depValidation } = await db.rpc('validate_manifest_dependencies', {
      validate_manifest_id: manifestId
    })

    // Store validation results
    for (const result of depValidation || []) {
      await db
        .from('manifest_validation_results')
        .insert({
          manifest_id: manifestId,
          validation_type: result.validation_type,
          validation_status: result.validation_status,
          validation_score: result.validation_score,
          validation_details: result.validation_details,
          error_messages: result.error_messages
        })
    }

    return true
  } catch (err: any) {
    throw new Error(`Validation failed: ${err.message}`)
  }
}

export async function publishManifest(ctx: any, manifestId: string, validateBeforePublish: boolean = true) {
  const { data: manifest } = await db
    .from('local_pack_manifests')
    .select('*')
    .eq('id', manifestId)
    .eq('account_id', ctx.accountId)
    .single()

  if (!manifest) throw new Error('Manifest not found')

  const success = await db.rpc('publish_manifest', {
    publish_manifest_id: manifestId,
    validate_before_publish: validateBeforePublish
  })

  if (success) {
    await emitAudit(ctx, 'update', 'local_manifest', manifestId, manifest, { manifest_status: 'published' })
    await emitActivity(ctx, 'manifest.published', `Published manifest ${manifest.manifest_name}`, 'manifest', manifestId)
  } else {
    await emitActivity(ctx, 'manifest.publish_failed', `Failed to publish manifest ${manifest.manifest_name}`, 'manifest', manifestId)
  }

  return {
    manifest_id: manifestId,
    manifest_name: manifest.manifest_name,
    published: success,
    message: success ? 'Manifest published successfully' : 'Manifest validation failed'
  }
}
