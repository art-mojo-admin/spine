import { createHandler, requireAuth, requireTenant, requireRole, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const type = params.get('type') as 'schema' | 'stats' | 'principal' | 'health'
    const principalId = params.get('principal_id')
    const includeSystem = params.get('include_system') === 'true'

    try {
      let result

      switch (type) {
        case 'schema':
          result = await getAccountSchema(ctx.accountId!, includeSystem)
          break
        case 'stats':
          result = await getRuntimeStats(ctx.accountId!)
          break
        case 'principal':
          result = await getPrincipalInfo(ctx.accountId!, principalId || undefined)
          break
        case 'health':
          const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
          if (roleCheck) return roleCheck
          result = await getSystemHealth()
          break
        default:
          throw new Error(`Invalid introspection type: ${type}`)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Introspection failed', 500)
    }
  },

  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      type: 'schema' | 'stats' | 'principal' | 'health'
      principal_id?: string
      include_system?: boolean
      refresh_cache?: boolean
    }>(req)

    if (!body.type) return error('type required')

    try {
      let result

      switch (body.type) {
        case 'schema':
          result = await getAccountSchema(ctx.accountId!, body.include_system || false)
          break
        case 'stats':
          result = await getRuntimeStats(ctx.accountId!)
          break
        case 'principal':
          result = await getPrincipalInfo(ctx.accountId!, body.principal_id)
          break
        case 'health':
          const roleCheck = requireRole(ctx, ['admin', 'system_admin'])
          if (roleCheck) return roleCheck
          result = await getSystemHealth()
          break
        default:
          throw new Error(`Invalid introspection type: ${body.type}`)
      }

      return json(result)
    } catch (err: any) {
      return error(err.message || 'Introspection failed', 500)
    }
  },
})

async function getAccountSchema(accountId: string, includeSystem: boolean = false) {
  const { data, error } = await db.rpc('get_account_schema', {
    introspect_account_id: accountId,
    include_system_types: includeSystem
  })

  if (error) throw error

  return {
    type: 'schema',
    account_id: accountId,
    include_system: includeSystem,
    generated_at: new Date().toISOString(),
    ...data
  }
}

async function getRuntimeStats(accountId: string) {
  const { data, error } = await db.rpc('get_runtime_stats', {
    stats_account_id: accountId
  })

  if (error) throw error

  return {
    type: 'stats',
    account_id: accountId,
    generated_at: new Date().toISOString(),
    ...data
  }
}

async function getPrincipalInfo(accountId: string, principalId?: string) {
  const { data, error } = await db.rpc('get_principal_info', {
    principal_account_id: accountId,
    principal_id: principalId || null
  })

  if (error) throw error

  return {
    type: 'principal',
    account_id: accountId,
    principal_id: principalId,
    generated_at: new Date().toISOString(),
    ...data
  }
}

async function getSystemHealth() {
  const { data, error } = await db.rpc('get_system_health')

  if (error) throw error

  // Add system overview
  const { data: overview } = await db
    .from('system_overview')
    .select('*')
    .single()

  return {
    type: 'health',
    generated_at: new Date().toISOString(),
    ...data,
    overview
  }
}

// Additional helper functions for detailed introspection

export async function getItemTypeDetails(accountId: string, itemTypeSlug: string) {
  const { data, error } = await db
    .from('item_type_registry')
    .select(`
      *,
      field_definitions:account_id!inner (
        field_key,
        field_type,
        field_label,
        is_required,
        default_value,
        validation_rules,
        display_config
      )
    `)
    .eq('slug', itemTypeSlug)
    .single()

  if (error) throw error

  return data
}

export async function getLinkTypeDetails(accountId: string, linkTypeSlug: string) {
  const { data, error } = await db
    .from('link_type_definitions')
    .select('*')
    .eq('slug', linkTypeSlug)
    .eq('account_id', accountId)
    .single()

  if (error) throw error

  return data
}

export async function getAccountActivitySummary(accountId: string, days: number = 30) {
  const { data, error } = await db
    .from('item_events')
    .select(`
      event_type,
      COUNT(*) as count,
      DATE_TRUNC('day', created_at) as day
    `)
    .eq('account_id', accountId)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('day', { ascending: true })

  if (error) throw error

  return {
    account_id: accountId,
    period_days: days,
    activity_by_type: data || []
  }
}

export async function getPrincipalActivitySummary(accountId: string, principalId: string, days: number = 30) {
  const { data, error } = await db
    .from('item_events')
    .select(`
      event_type,
      COUNT(*) as count,
      DATE_TRUNC('day', created_at) as day
    `)
    .eq('account_id', accountId)
    .eq('actor_principal_id', principalId)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('day', { ascending: true })

  if (error) throw error

  return {
    account_id: accountId,
    principal_id: principalId,
    period_days: days,
    activity_by_type: data || []
  }
}
