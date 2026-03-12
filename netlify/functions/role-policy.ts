import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import type { RequestContext, HandlerResult } from './_shared/middleware'
import { db } from './_shared/db'
import { emitAudit } from './_shared/audit'

type Ownership = 'pack' | 'tenant'

interface FieldInput {
  field_path: string
  visibility?: Record<string, unknown>
  editability?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

interface UpsertPolicyBody {
  action: 'upsert_policy'
  entity_type: string
  entity_id: string
  account_id?: string | null
  pack_id?: string | null
  ownership?: Ownership
  template_entity_id?: string | null
  visibility?: Record<string, unknown>
  editability?: Record<string, unknown>
  metadata?: Record<string, unknown>
  version_tag?: string | null
  version_note?: string | null
  fields?: FieldInput[]
}

interface DeletePolicyBody {
  action: 'delete_policy'
  policy_id?: string
  entity_type?: string
  entity_id?: string
}

const DEFAULT_POLICY = { default_role: 'member' }

function isSystemRole(role: string | null): boolean {
  return role === 'system_admin' || role === 'system_operator'
}

function ensureObject<T extends Record<string, unknown>>(value: T | undefined | null): T {
  return (value && typeof value === 'object') ? value : ({ ...DEFAULT_POLICY } as T)
}

function requireSystemRole(ctx: RequestContext): HandlerResult | null {
  if (isSystemRole(ctx.systemRole)) return null
  return error('System role required', 403)
}

async function authorizeTenantScope(ctx: RequestContext, accountId: string | null): Promise<HandlerResult | null> {
  if (!accountId) {
    return error('account_id required for tenant-owned policies')
  }

  if (isSystemRole(ctx.systemRole)) {
    return null
  }

  if (ctx.accountId !== accountId) {
    return error('Cannot modify another account without system role', 403)
  }

  const tenantCheck = requireTenant(ctx)
  if (tenantCheck) return tenantCheck

  const roleCheck = requireRole(ctx, ['admin'])
  if (roleCheck) return roleCheck

  return null
}

async function upsertPolicy(ctx: RequestContext, body: UpsertPolicyBody) {
  const {
    entity_type,
    entity_id,
    account_id,
    pack_id,
    ownership,
    template_entity_id,
    visibility,
    editability,
    metadata,
    version_tag,
    version_note,
    fields = [],
  } = body

  if (!entity_type || !entity_id) {
    return error('entity_type and entity_id are required')
  }

  const targetOwnership: Ownership = ownership ?? (account_id ? 'tenant' : 'pack')

  if (targetOwnership === 'pack') {
    const sysCheck = requireSystemRole(ctx)
    if (sysCheck) return sysCheck
    if (!pack_id) {
      return error('pack_id required for pack-owned policies')
    }
  } else {
    const tenantAuth = await authorizeTenantScope(ctx, account_id ?? ctx.accountId ?? null)
    if (tenantAuth) return tenantAuth
  }

  const { data: existing, error: fetchErr } = await db
    .from('role_policies')
    .select('id, metadata')
    .eq('entity_type', entity_type)
    .eq('entity_id', entity_id)
    .maybeSingle()

  if (fetchErr) {
    console.error('[role-policy] fetch existing failed', fetchErr)
    return error('Unable to fetch existing policy', 500)
  }

  const mergedMetadata = {
    ...(existing?.metadata ?? {}),
    ...(metadata ?? {}),
  }

  if (version_tag !== undefined) {
    mergedMetadata.version_tag = version_tag
    mergedMetadata.version_note = version_note ?? null
    mergedMetadata.version_updated_at = new Date().toISOString()
    mergedMetadata.version_updated_by = ctx.personId
  }

  const upsertPayload = {
    entity_type,
    entity_id,
    account_id: targetOwnership === 'tenant' ? (account_id ?? ctx.accountId ?? null) : null,
    pack_id: pack_id ?? null,
    ownership: targetOwnership,
    template_entity_id: template_entity_id ?? null,
    visibility: ensureObject(visibility),
    editability: ensureObject(editability),
    metadata: mergedMetadata,
  }

  const { data: policyRow, error: upsertErr } = await db
    .from('role_policies')
    .upsert(upsertPayload, { onConflict: 'entity_type,entity_id' })
    .select('id, entity_type, entity_id, account_id, pack_id, ownership, template_entity_id, visibility, editability, metadata')
    .single()

  if (upsertErr) {
    console.error('[role-policy] upsert failed', upsertErr)
    return error('Unable to save role policy', 500)
  }

  const normalizedFields = fields.filter((field) => field.field_path)

  await db.from('field_role_policies').delete().eq('role_policy_id', policyRow.id)

  let insertedFields: any[] = []
  if (normalizedFields.length > 0) {
    const rows = normalizedFields.map((field) => ({
      role_policy_id: policyRow.id,
      field_path: field.field_path,
      visibility: ensureObject(field.visibility),
      editability: ensureObject(field.editability),
      metadata: field.metadata ?? {},
    }))

    const { data: fieldRows, error: fieldErr } = await db
      .from('field_role_policies')
      .insert(rows)
      .select('id, role_policy_id, field_path, visibility, editability, metadata')

    if (fieldErr) {
      console.error('[role-policy] field upsert failed', fieldErr)
      return error('Unable to save field-level policies', 500)
    }
    insertedFields = fieldRows ?? []
  }

  await emitAudit(ctx, 'role_policy.upsert', 'role_policy', policyRow.id, existing ?? null, {
    ...policyRow,
    fields: insertedFields,
  })

  return json({
    policy: {
      ...policyRow,
      fields: insertedFields,
    },
  })
}

async function deletePolicy(ctx: RequestContext, body: DeletePolicyBody) {
  const { policy_id, entity_type, entity_id } = body

  if (!policy_id && (!entity_type || !entity_id)) {
    return error('policy_id or (entity_type + entity_id) required')
  }

  let policyQuery = db
    .from('role_policies')
    .select('*')
    .limit(1)

  if (policy_id) {
    policyQuery = policyQuery.eq('id', policy_id)
  } else {
    policyQuery = policyQuery.eq('entity_type', entity_type!).eq('entity_id', entity_id!)
  }

  const { data: policy, error: fetchErr } = await policyQuery.single()
  if (fetchErr || !policy) {
    return error('Policy not found', 404)
  }

  if (policy.ownership === 'pack') {
    const sysCheck = requireSystemRole(ctx)
    if (sysCheck) return sysCheck
  } else {
    const tenantAuth = await authorizeTenantScope(ctx, policy.account_id)
    if (tenantAuth) return tenantAuth
  }

  const { error: deleteErr } = await db.from('role_policies').delete().eq('id', policy.id)
  if (deleteErr) {
    console.error('[role-policy] delete failed', deleteErr)
    return error('Unable to delete policy', 500)
  }

  await emitAudit(ctx, 'role_policy.deleted', 'role_policy', policy.id, policy, null)

  return json({ success: true })
}

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const body = await parseBody<UpsertPolicyBody | DeletePolicyBody>(req)

    if (body.action === 'upsert_policy') {
      return upsertPolicy(ctx, body)
    }

    if (body.action === 'delete_policy') {
      return deletePolicy(ctx, body)
    }

    return error('Unknown action. Use upsert_policy or delete_policy')
  },
})
