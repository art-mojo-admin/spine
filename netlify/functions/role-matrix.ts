import { createHandler, requireAuth, requireTenant, requireRole, json, error } from './_shared/middleware'
import { db } from './_shared/db'

type Ownership = 'pack' | 'tenant'

interface FieldPolicyRow {
  id: string
  role_policy_id: string
  field_path: string
  visibility: Record<string, unknown>
  editability: Record<string, unknown>
  metadata: Record<string, unknown>
}

interface RolePolicyRow {
  id: string
  entity_type: string
  entity_id: string
  account_id: string | null
  pack_id: string | null
  ownership: Ownership
  template_entity_id: string | null
  visibility: Record<string, unknown>
  editability: Record<string, unknown>
  metadata: Record<string, unknown>
  field_role_policies?: FieldPolicyRow[]
}

interface PackSummary {
  id: string
  name: string
  slug: string | null
  icon: string | null
  category: string | null
}

interface EntitySummary {
  id: string
  type: string
  label: string
  slug: string | null
  icon: string | null
  status: string | null
  attributes: Record<string, unknown>
}

interface EntityConfig {
  table: string
  labelFields: string[]
  slugField?: string
  iconField?: string
  statusField?: string
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  workflow_definition: {
    table: 'workflow_definitions',
    labelFields: ['name'],
    statusField: 'status',
  },
  stage_definition: {
    table: 'stage_definitions',
    labelFields: ['name'],
  },
  transition_definition: {
    table: 'transition_definitions',
    labelFields: ['name'],
  },
  workflow_action: {
    table: 'workflow_actions',
    labelFields: ['name'],
  },
  automation_rule: {
    table: 'automation_rules',
    labelFields: ['name'],
  },
  custom_field_definition: {
    table: 'custom_field_definitions',
    labelFields: ['name', 'field_key'],
    slugField: 'field_key',
  },
  link_type_definition: {
    table: 'link_type_definitions',
    labelFields: ['name', 'slug'],
    slugField: 'slug',
  },
  view_definition: {
    table: 'view_definitions',
    labelFields: ['name', 'slug'],
    slugField: 'slug',
  },
  app_definition: {
    table: 'app_definitions',
    labelFields: ['name', 'slug'],
    slugField: 'slug',
    iconField: 'icon',
  },
  account_module: {
    table: 'account_modules',
    labelFields: ['label', 'module_slug'],
    slugField: 'module_slug',
  },
  custom_action_type: {
    table: 'custom_action_types',
    labelFields: ['name', 'slug'],
    slugField: 'slug',
  },
  thread: {
    table: 'threads',
    labelFields: ['thread_type', 'target_type'],
    statusField: 'status',
  },
  message: {
    table: 'messages',
    labelFields: ['direction', 'sequence'],
  },
  item: {
    table: 'items',
    labelFields: ['title'],
    statusField: 'status',
  },
  entity_link: {
    table: 'entity_links',
    labelFields: ['link_type'],
    slugField: 'link_type',
  },
}

function isSystemRole(role: string | null): boolean {
  return !!role && ['system_admin', 'system_operator'].includes(role)
}

function normalizeState(value: string | null): 'all' | 'account' | 'template' {
  if (value === 'account' || value === 'template') return value
  return 'all'
}

function summarizeFieldPolicies(rows: FieldPolicyRow[] | undefined): FieldPolicyRow[] {
  if (!rows?.length) return []
  return [...rows].sort((a, b) => a.field_path.localeCompare(b.field_path))
}

interface PolicyFilter {
  accountId?: string | null
  packId?: string | null
  ownership?: Ownership
  entityType?: string | null
}

async function fetchPolicyChunk(filter: PolicyFilter): Promise<RolePolicyRow[]> {
  let query = db
    .from('role_policies')
    .select('*, field_role_policies ( id, role_policy_id, field_path, visibility, editability, metadata )')
    .order('entity_type', { ascending: true })
    .order('created_at', { ascending: false })

  if (filter.accountId !== undefined) {
    if (filter.accountId) {
      query = query.eq('account_id', filter.accountId)
    } else {
      query = query.is('account_id', null)
    }
  }

  if (filter.packId !== undefined) {
    if (filter.packId) {
      query = query.eq('pack_id', filter.packId)
    } else {
      query = query.is('pack_id', null)
    }
  }

  if (filter.ownership) {
    query = query.eq('ownership', filter.ownership)
  }

  if (filter.entityType) {
    query = query.eq('entity_type', filter.entityType)
  }

  const { data, error: dbErr } = await query
  if (dbErr) {
    throw new Error(dbErr.message)
  }
  return (data ?? []) as RolePolicyRow[]
}

async function loadEntityMetadata(policies: RolePolicyRow[]): Promise<Map<string, Record<string, unknown>>> {
  const bucket = new Map<string, Set<string>>()
  for (const policy of policies) {
    if (!bucket.has(policy.entity_type)) bucket.set(policy.entity_type, new Set())
    bucket.get(policy.entity_type)!.add(policy.entity_id)
    if (policy.template_entity_id) {
      bucket.get(policy.entity_type)!.add(policy.template_entity_id)
    }
  }

  const result = new Map<string, Record<string, unknown>>()
  await Promise.all(
    Array.from(bucket.entries()).map(async ([entityType, ids]) => {
      const config = ENTITY_CONFIG[entityType]
      if (!config) return
      const idList = Array.from(ids)
      if (idList.length === 0) return
      const { data, error: dbErr } = await db
        .from(config.table)
        .select('*')
        .in('id', idList)

      if (dbErr) {
        throw new Error(dbErr.message)
      }
      for (const row of data || []) {
        result.set(`${entityType}:${row.id}`, row as Record<string, unknown>)
      }
    }),
  )

  return result
}

async function loadPackMap(policies: RolePolicyRow[], explicitPackId?: string | null): Promise<Map<string, PackSummary>> {
  const ids = new Set<string>()
  if (explicitPackId) ids.add(explicitPackId)
  for (const policy of policies) {
    if (policy.pack_id) ids.add(policy.pack_id)
  }
  if (ids.size === 0) {
    return new Map()
  }
  const { data, error: dbErr } = await db
    .from('config_packs')
    .select('id, name, slug, icon, category')
    .in('id', Array.from(ids))
  if (dbErr) {
    throw new Error(dbErr.message)
  }
  return new Map((data || []).map((row) => [row.id, row as PackSummary]))
}

function summarizeEntity(entityType: string, row: Record<string, unknown> | undefined): EntitySummary | null {
  if (!row) return null
  const config = ENTITY_CONFIG[entityType]
  const labelCandidates = config?.labelFields ?? []
  const labelValue = labelCandidates.map((field) => row[field] as string | undefined).find((value) => !!value)
  const label = labelValue || `${entityType} ${row.id}`
  const slugField = config?.slugField
  const iconField = config?.iconField
  const statusField = config?.statusField
  const status = statusField ? (row[statusField] as string | null | undefined) : (row['is_active'] === false ? 'inactive' : 'active')

  return {
    id: String(row.id),
    type: entityType,
    label: String(label),
    slug: slugField && row[slugField] ? String(row[slugField]) : null,
    icon: iconField && row[iconField] ? String(row[iconField]) : null,
    status: status ? String(status) : null,
    attributes: row,
  }
}

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const packId = params.get('pack_id')
    const entityTypeFilter = params.get('entity_type')
    const includeAccountParam = params.get('include_account')
    const includeTemplatesParam = params.get('include_templates')
    const state = normalizeState(params.get('state'))

    let targetAccountId = params.get('account_id') || ctx.accountId || null

    if (!targetAccountId && !packId) {
      return error('account_id or pack_id required')
    }

    if (targetAccountId && targetAccountId !== ctx.accountId && !isSystemRole(ctx.systemRole)) {
      return error('System role required to inspect another account', 403)
    }

    if (!targetAccountId && !isSystemRole(ctx.systemRole)) {
      return error('System role required without account scope', 403)
    }

    const sameAccount = targetAccountId && targetAccountId === ctx.accountId
    if (sameAccount) {
      const tenantCheck = requireTenant(ctx)
      if (tenantCheck) return tenantCheck
      const roleCheck = requireRole(ctx, ['admin', 'operator'])
      if (roleCheck) return roleCheck
    }

    const includeAccount = Boolean(targetAccountId && (state === 'all' || state === 'account') && includeAccountParam !== 'false')
    const includeTemplates = Boolean(packId && (state === 'all' || state === 'template') && includeTemplatesParam !== 'false')

    try {
      const policies: RolePolicyRow[] = []

      if (includeAccount && targetAccountId) {
        const accountPolicies = await fetchPolicyChunk({
          accountId: targetAccountId,
          ownership: 'tenant',
          entityType: entityTypeFilter,
        })
        policies.push(...accountPolicies)
      }

      if (includeTemplates && packId) {
        const templatePolicies = await fetchPolicyChunk({
          packId,
          ownership: 'pack',
          entityType: entityTypeFilter,
        })
        policies.push(...templatePolicies)
      }

      if (policies.length === 0) {
        return json({
          account_id: targetAccountId,
          pack_id: packId,
          state,
          total: 0,
          totals_by_entity: {},
          policies: [],
        })
      }

      const [entityMetadata, packMap] = await Promise.all([
        loadEntityMetadata(policies),
        loadPackMap(policies, packId),
      ])

      const normalizedPolicies = policies.map((policy) => {
        const entityKey = `${policy.entity_type}:${policy.entity_id}`
        const templateKey = policy.template_entity_id
          ? `${policy.entity_type}:${policy.template_entity_id}`
          : null
        const entitySummary = summarizeEntity(policy.entity_type, entityMetadata.get(entityKey))
        const templateSummary = templateKey ? summarizeEntity(policy.entity_type, entityMetadata.get(templateKey)) : null

        return {
          id: policy.id,
          entity_type: policy.entity_type,
          entity_id: policy.entity_id,
          ownership: policy.ownership,
          account_id: policy.account_id,
          pack_id: policy.pack_id,
          template_entity_id: policy.template_entity_id,
          visibility: policy.visibility,
          editability: policy.editability,
          metadata: policy.metadata,
          pack: policy.pack_id ? packMap.get(policy.pack_id) || null : null,
          entity: entitySummary,
          template_entity: templateSummary,
          fields: summarizeFieldPolicies(policy.field_role_policies),
        }
      })

      const totalsByEntity = normalizedPolicies.reduce<Record<string, number>>((acc, policy) => {
        acc[policy.entity_type] = (acc[policy.entity_type] || 0) + 1
        return acc
      }, {})

      return json({
        account_id: targetAccountId,
        pack_id: packId,
        state,
        total: normalizedPolicies.length,
        totals_by_entity: totalsByEntity,
        policies: normalizedPolicies,
      })
    } catch (err: any) {
      console.error('[role-matrix] Failed to load role matrix:', err)
      return error('Unable to load role matrix', 500)
    }
  },
})

