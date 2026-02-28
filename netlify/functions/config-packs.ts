import { randomUUID } from 'crypto'

import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'
import { emitActivity } from './_shared/audit'
import { recalcAllCounts } from './_shared/counts'

// Tables that have pack_id and is_active columns for toggling
const PACK_TABLES = [
  'workflow_definitions',
  'stage_definitions',
  'transition_definitions',
  'workflow_actions',
  'items',
  'automation_rules',
  'custom_field_definitions',
  'link_type_definitions',
  'entity_links',
  'account_modules',
  'custom_action_types',
  'view_definitions',
  'app_definitions',
  'knowledge_base_articles',
  'threads',
  'messages',
  'enrollments',
] as const

// Shared test data tables (no pack_id — shared across packs)
const SHARED_TEST_TABLES = ['accounts', 'persons', 'memberships'] as const
const TEMPLATE_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'

// Tables that DO have an account_id column (for scoping to tenant)
const TABLES_WITH_ACCOUNT_ID = new Set([
  'workflow_definitions', 'items', 'automation_rules',
  'custom_field_definitions', 'link_type_definitions', 'entity_links',
  'account_modules', 'custom_action_types', 'view_definitions', 'app_definitions',
  'knowledge_base_articles', 'threads', 'enrollments',
])
// Tables WITHOUT account_id — children linked via parent FK
// stage_definitions, transition_definitions, workflow_actions, messages

const CLONE_SEQUENCE: { table: typeof PACK_TABLES[number]; entityType: string }[] = [
  { table: 'workflow_definitions', entityType: 'workflow_definition' },
  { table: 'stage_definitions', entityType: 'stage_definition' },
  { table: 'transition_definitions', entityType: 'transition_definition' },
  { table: 'workflow_actions', entityType: 'workflow_action' },
  { table: 'automation_rules', entityType: 'automation_rule' },
  { table: 'custom_field_definitions', entityType: 'custom_field_definition' },
  { table: 'link_type_definitions', entityType: 'link_type_definition' },
  { table: 'view_definitions', entityType: 'view_definition' },
  { table: 'app_definitions', entityType: 'app_definition' },
  { table: 'account_modules', entityType: 'account_module' },
  { table: 'custom_action_types', entityType: 'custom_action_type' },
  { table: 'knowledge_base_articles', entityType: 'knowledge_base_article' },
  { table: 'threads', entityType: 'thread' },
  { table: 'messages', entityType: 'message' },
  { table: 'items', entityType: 'item' },
  { table: 'entity_links', entityType: 'entity_link' },
  { table: 'enrollments', entityType: 'enrollment' },
]

function combineCounts(...datasets: Record<string, number>[]) {
  const result: Record<string, number> = {}
  for (const data of datasets) {
    for (const [key, value] of Object.entries(data)) {
      result[key] = (result[key] || 0) + (value || 0)
    }
  }
  return result
}

async function fetchMappings(accountId: string, packId: string) {
  const { data } = await db
    .from('pack_entity_mappings')
    .select('entity_type, template_id, cloned_id')
    .eq('account_id', accountId)
    .eq('pack_id', packId)

  const mapByTemplate: Record<string, string> = {}
  const mapByClone: Record<string, { entity_type: string; template_id: string }> = {}
  for (const row of data || []) {
    mapByTemplate[row.template_id] = row.cloned_id
    mapByClone[row.cloned_id] = { entity_type: row.entity_type, template_id: row.template_id }
  }

  return { mapByTemplate, mapByClone }
}

async function removeMapping(accountId: string, packId: string, entityType: string, templateId: string) {
  await db
    .from('pack_entity_mappings')
    .delete()
    .eq('account_id', accountId)
    .eq('pack_id', packId)
    .eq('entity_type', entityType)
    .eq('template_id', templateId)
}

async function upsertMapping(accountId: string, packId: string, entityType: string, templateId: string, clonedId: string) {
  await db
    .from('pack_entity_mappings')
    .upsert({
      account_id: accountId,
      pack_id: packId,
      entity_type: entityType,
      template_id: templateId,
      cloned_id: clonedId,
    }, { onConflict: 'account_id,entity_type,template_id' })
}

async function fetchPackTemplates(packId: string, templateAccountId: string) {
  const templates: Record<string, any[]> = {}

  for (const table of PACK_TABLES) {
    let query = (db.from(table) as any)
      .select('*')
      .eq('pack_id', packId)

    // Only filter by account_id for tables that have the column
    if (TABLES_WITH_ACCOUNT_ID.has(table)) {
      query = query.eq('account_id', templateAccountId)
    }

    const { data } = await query
    templates[table] = data || []
  }

  return templates
}

async function cloneTemplateRow(table: string, template: any, accountId: string, packId: string, entityMap: Record<string, string>) {
  const newId = randomUUID()
  const cloned = { ...template }

  cloned.id = newId

  if ('account_id' in cloned) {
    cloned.account_id = accountId
  }
  if ('pack_id' in cloned) cloned.pack_id = packId
  const isTestData = template.is_test_data === true
  if ('is_active' in cloned) cloned.is_active = isTestData ? (template.is_active ?? false) : true
  if ('is_test_data' in cloned) cloned.is_test_data = isTestData

  for (const key of Object.keys(cloned)) {
    if (!key.endsWith('_id')) continue
    if (key === 'account_id' || key === 'pack_id') continue
    const value = cloned[key]
    if (typeof value === 'string' && entityMap[value]) {
      cloned[key] = entityMap[value]
    }
  }

  delete cloned.created_at
  delete cloned.updated_at

  await (db.from(table) as any).insert(cloned)

  return newId
}

async function cloneTemplatesForPack(packId: string, accountId: string, isTestData: boolean) {
  const templates = await fetchPackTemplates(packId, TEMPLATE_ACCOUNT_ID)

  const { mapByTemplate } = await fetchMappings(accountId, packId)
  const entityMap = { ...mapByTemplate }

  for (const { table, entityType } of CLONE_SEQUENCE) {
    const rows = templates[table] || []
    for (const template of rows) {
      const templateIsTest = template.is_test_data === true
      if (templateIsTest !== isTestData) continue

      const mappedId = entityMap[template.id]
      if (mappedId) {
        const { data: stillExists } = await (db.from(table) as any)
          .select('id')
          .eq('id', mappedId)
          .maybeSingle()
        if (stillExists) continue

        await removeMapping(accountId, packId, entityType, template.id)
        delete entityMap[template.id]
      }

      const clonedId = await cloneTemplateRow(table, template, accountId, packId, entityMap)
      entityMap[template.id] = clonedId

      await upsertMapping(accountId, packId, entityType, template.id, clonedId)
    }
  }
}

async function ensurePackConfigCloned(packId: string, accountId: string) {
  await cloneTemplatesForPack(packId, accountId, false)
}

async function ensurePackTestDataCloned(packId: string, accountId: string) {
  await cloneTemplatesForPack(packId, accountId, true)
}

async function setClonedEntitiesActive(accountId: string, packId: string, active: boolean, testDataOnly: boolean | null) {
  const { mapByTemplate } = await fetchMappings(accountId, packId)
  const clonedIds = Object.values(mapByTemplate)
  if (clonedIds.length === 0) return {} as Record<string, number>

  const counts: Record<string, number> = {}

  for (const table of PACK_TABLES) {
    let query = (db.from(table) as any)
      .update({ is_active: active })
      .eq('pack_id', packId)

    if (TABLES_WITH_ACCOUNT_ID.has(table)) {
      query = query.eq('account_id', accountId)
    } else {
      // For child tables without account_id, scope to cloned IDs
      query = query.in('id', clonedIds)
    }

    if (testDataOnly === true) {
      query = query.eq('is_test_data', true)
    } else if (testDataOnly === false) {
      query = query.eq('is_test_data', false)
    }

    const { data } = await query.select('id')
    counts[table] = data?.length || 0
  }

  return counts
}

async function setPackConfigActive(accountId: string, packId: string, active: boolean) {
  return setClonedEntitiesActive(accountId, packId, active, false)
}

async function setPackTestDataActive(accountId: string, packId: string, active: boolean) {
  return setClonedEntitiesActive(accountId, packId, active, true)
}

async function uninstallPack(accountId: string, packId: string) {
  const { mapByTemplate } = await fetchMappings(accountId, packId)
  const clonedIds = Object.values(mapByTemplate)

  if (clonedIds.length > 0) {
    const deleteSequence = [...CLONE_SEQUENCE].reverse()
    for (const { table } of deleteSequence) {
      if (TABLES_WITH_ACCOUNT_ID.has(table)) {
        await (db.from(table) as any)
          .delete()
          .eq('account_id', accountId)
          .eq('pack_id', packId)
      } else {
        await (db.from(table) as any)
          .delete()
          .in('id', clonedIds)
          .eq('pack_id', packId)
      }
    }
  }

  await db.from('pack_entity_mappings')
    .delete()
    .eq('account_id', accountId)
    .eq('pack_id', packId)

  await db.from('pack_activations').upsert({
    account_id: accountId,
    pack_id: packId,
    config_active: false,
    test_data_active: false,
  }, { onConflict: 'account_id,pack_id' })

  const otherActive = await anyPackHasTestDataActive(accountId, packId)
  if (!otherActive) {
    await setSharedTestDataActive(false, accountId)
  }

  await recalcAllCounts(accountId)
}

// ── Shared test data helpers ──────────────────────────────────────────
async function setSharedTestDataActive(active: boolean, accountId?: string) {
  for (const table of SHARED_TEST_TABLES) {
    if (table === 'memberships') continue // handled below
    await (db.from(table) as any)
      .update({ is_active: active })
      .eq('is_test_data', true)
      .is('pack_id', null)
  }

  const [{ data: testPersons }, { data: testAccounts }] = await Promise.all([
    db.from('persons').select('id').eq('is_test_data', true).is('pack_id', null),
    db.from('accounts').select('id').eq('is_test_data', true).is('pack_id', null),
  ])

  const testPersonIds = (testPersons || []).map((p: any) => p.id)
  const sharedAccountIds = (testAccounts || []).map((a: any) => a.id)

  if (testPersonIds.length === 0) return

  const targetAccountIds = new Set<string>(sharedAccountIds)
  if (accountId) targetAccountIds.add(accountId)

  if (targetAccountIds.size === 0) return

  if (active) {
    for (const targetId of targetAccountIds) {
      for (const personId of testPersonIds) {
        await (db.from('memberships') as any)
          .upsert({
            person_id: personId,
            account_id: targetId,
            account_role: 'member',
            status: 'active',
            is_active: true,
            is_test_data: true,
          }, { onConflict: 'person_id,account_id' })
      }
    }
    return
  }

  await (db.from('memberships') as any)
    .update({ is_active: false })
    .in('account_id', Array.from(targetAccountIds))
    .eq('is_test_data', true)
}

async function anyPackHasTestDataActive(accountId: string, excludePackId?: string): Promise<boolean> {
  let query = db
    .from('pack_activations')
    .select('id')
    .eq('account_id', accountId)
    .eq('test_data_active', true)
    .limit(1)

  if (excludePackId) {
    query = query.neq('pack_id', excludePackId)
  }

  const { data } = await query
  return (data?.length || 0) > 0
}
// ──────────────────────────────────────────────────────────────────────

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck

    const id = params.get('id')
    const action = params.get('action')

    // Export a pack as JSON
    if (id && action === 'export') {
      const { data: pack } = await db.from('config_packs').select('*').eq('id', id).single()
      if (!pack) return error('Not found', 404)

      const [workflows, stages, transitions, fields, linkTypes, automations, views, apps, docs] = await Promise.all([
        db.from('workflow_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('stage_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('transition_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('custom_field_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('link_type_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('automation_rules').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('view_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('app_definitions').select('*').eq('pack_id', id).eq('is_test_data', false),
        db.from('knowledge_base_articles').select('*').eq('pack_id', id).eq('is_test_data', false),
      ])

      const [testItems, testLinks, testThreads] = await Promise.all([
        db.from('items').select('*').eq('pack_id', id).eq('is_test_data', true),
        db.from('entity_links').select('*').eq('pack_id', id).eq('is_test_data', true),
        db.from('threads').select('*').eq('pack_id', id).eq('is_test_data', true),
      ])

      return json({
        spine_pack_version: 2,
        name: pack.name,
        slug: pack.slug,
        description: pack.description,
        icon: pack.icon,
        category: pack.category,
        config: {
          workflows: workflows.data || [],
          stages: stages.data || [],
          transitions: transitions.data || [],
          custom_fields: fields.data || [],
          link_types: linkTypes.data || [],
          automations: automations.data || [],
          views: views.data || [],
          apps: apps.data || [],
          documents: docs.data || [],
        },
        test_data: {
          items: testItems.data || [],
          entity_links: testLinks.data || [],
          threads: testThreads.data || [],
        },
      })
    }

    // Get single pack
    if (id) {
      const { data: pack } = await db.from('config_packs').select('*').eq('id', id).single()
      if (!pack) return error('Not found', 404)
      return json(pack)
    }

    // List all packs with activation state for current account
    const { data: packs } = await db
      .from('config_packs')
      .select('id, name, slug, icon, category, description, is_system, pack_data, created_at')
      .order('name')

    // Get activations for current account
    let activations: any[] = []
    if (ctx.accountId) {
      const { data } = await db
        .from('pack_activations')
        .select('*')
        .eq('account_id', ctx.accountId)

      activations = data || []
    }

    const activationMap = new Map(activations.map((a: any) => [a.pack_id, a]))

    const result = (packs || []).map((pack: any) => {
      const activation = activationMap.get(pack.id)
      return {
        ...pack,
        config_active: activation?.config_active || false,
        test_data_active: activation?.test_data_active || false,
        activated_by: activation?.activated_by || null,
        activated_at: activation?.activated_at || null,
      }
    })

    return json(result)
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck
    const roleCheck = requireRole(ctx, ['admin'])
    if (roleCheck) return roleCheck

    const body = await parseBody<any>(req)
    const action = body.action
    const packId = body.pack_id
    const accountId = ctx.accountId!

    // ── Install Pack ──────────────────────────────────────────────────
    // Clones all config (and optionally test data) as tenant-owned, active rows
    if (action === 'install_pack') {
      if (!packId) return error('pack_id required')

      const { data: pack } = await db.from('config_packs').select('id, name').eq('id', packId).single()
      if (!pack) return error('Pack not found', 404)

      // Check if already installed
      const { data: existing } = await db
        .from('pack_activations')
        .select('config_active')
        .eq('account_id', accountId)
        .eq('pack_id', packId)
        .maybeSingle()

      if (existing?.config_active) {
        return error('Pack is already installed. Uninstall first to reinstall.', 409)
      }

      // Clone config rows (workflows, fields, views, apps, etc.)
      await cloneTemplatesForPack(packId, accountId, false)
      await setClonedEntitiesActive(accountId, packId, true, false)

      // Optionally clone test data
      const includeTestData = body.include_test_data === true
      if (includeTestData) {
        await cloneTemplatesForPack(packId, accountId, true)
        await setClonedEntitiesActive(accountId, packId, true, true)
        await setSharedTestDataActive(true, accountId)
      }

      // Record activation
      await db.from('pack_activations').upsert({
        account_id: accountId,
        pack_id: packId,
        config_active: true,
        test_data_active: includeTestData,
        activated_by: ctx.personId,
        activated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,pack_id' })

      // Recalculate admin counts
      await recalcAllCounts(accountId)

      await emitActivity(ctx, 'config_pack.installed', `Installed pack "${pack.name}"${includeTestData ? ' with test data' : ''}`, 'config_pack', packId)
      return json({ success: true, action: 'installed', include_test_data: includeTestData })
    }

    if (action === 'install_test_data') {
      if (!packId) return error('pack_id required')

      const [{ data: pack }, { data: activation }] = await Promise.all([
        db.from('config_packs').select('id, name').eq('id', packId).single(),
        db.from('pack_activations').select('config_active, activated_at, activated_by').eq('account_id', accountId).eq('pack_id', packId).maybeSingle(),
      ])

      if (!pack) return error('Pack not found', 404)
      if (!activation?.config_active) {
        return error('Install the pack before adding test data', 400)
      }
      if (activation.test_data_active) {
        return json({ success: true, action: 'test_data_installed', already_active: true })
      }

      await ensurePackTestDataCloned(packId, accountId)
      await setPackTestDataActive(accountId, packId, true)
      await setSharedTestDataActive(true, accountId)

      await db.from('pack_activations').upsert({
        account_id: accountId,
        pack_id: packId,
        config_active: true,
        test_data_active: true,
        activated_by: activation.activated_by ?? ctx.personId,
        activated_at: activation.activated_at ?? new Date().toISOString(),
      }, { onConflict: 'account_id,pack_id' })

      await recalcAllCounts(accountId)
      await emitActivity(ctx, 'config_pack.test_data_installed', `Installed test data for pack "${pack.name}"`, 'config_pack', packId)
      return json({ success: true, action: 'test_data_installed' })
    }

    // ── Uninstall Pack ────────────────────────────────────────────────
    // Deletes all cloned rows and mappings for this pack
    if (action === 'uninstall_pack') {
      if (!packId) return error('pack_id required')

      const { data: pack } = await db.from('config_packs').select('id, name').eq('id', packId).single()
      if (!pack) return error('Pack not found', 404)

      await uninstallPack(accountId, packId)

      await emitActivity(ctx, 'config_pack.uninstalled', `Uninstalled pack "${pack.name}"`, 'config_pack', packId)
      return json({ success: true, action: 'uninstalled' })
    }

    if (action === 'uninstall_test_data') {
      if (!packId) return error('pack_id required')

      const [{ data: pack }, { data: activation }] = await Promise.all([
        db.from('config_packs').select('id, name').eq('id', packId).single(),
        db.from('pack_activations').select('config_active').eq('account_id', accountId).eq('pack_id', packId).maybeSingle(),
      ])

      if (!pack) return error('Pack not found', 404)
      if (!activation?.config_active) {
        return error('Pack is not installed for this account', 400)
      }

      await setPackTestDataActive(accountId, packId, false)

      await db.from('pack_activations').upsert({
        account_id: accountId,
        pack_id: packId,
        config_active: true,
        test_data_active: false,
      }, { onConflict: 'account_id,pack_id' })

      const otherActive = await anyPackHasTestDataActive(accountId, packId)
      if (!otherActive) {
        await setSharedTestDataActive(false, accountId)
      }

      await recalcAllCounts(accountId)
      await emitActivity(ctx, 'config_pack.test_data_uninstalled', `Removed test data for pack "${pack.name}"`, 'config_pack', packId)
      return json({ success: true, action: 'test_data_uninstalled' })
    }

    return error('Unknown action. Use install_pack or uninstall_pack')
  },
})
