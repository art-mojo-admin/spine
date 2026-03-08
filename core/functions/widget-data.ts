import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

interface DataSourceRequest {
  entity: string
  filters?: Record<string, any>
  group_by?: string
  aggregate?: string
  time_range?: string
  sort?: string
  limit?: number
  layers?: { label: string; time_range?: string; time_offset?: string }[]
}

const ALLOWED_ENTITIES: Record<string, string> = {
  items: 'items',
  persons: 'persons',
  accounts: 'accounts',
  activity_events: 'activity_events',
  entity_links: 'entity_links',
  memberships: 'memberships',
}

const ENTITY_SELECT: Record<string, string> = {
  items: 'id, item_type, title, priority, metadata, created_at, updated_at, stage_definition_id, workflow_definition_id, stage_definitions(name), workflow_definitions(name)',
  persons: 'id, full_name, email, status, metadata, created_at',
  accounts: 'id, display_name, metadata, created_at',
  activity_events: 'id, event_type, description, entity_type, entity_id, created_at',
  entity_links: 'id, source_type, source_id, target_type, target_id, link_type, metadata, created_at',
  memberships: 'id, person_id, account_id, account_role, status, created_at',
}

function resolveTimeRange(timeRange: string | undefined): Date | null {
  if (!timeRange || timeRange === 'all') return null
  const now = new Date()
  if (timeRange === 'ytd') return new Date(now.getFullYear(), 0, 1)
  const match = timeRange.match(/^(\d+)d$/)
  if (match) {
    return new Date(now.getTime() - parseInt(match[1], 10) * 24 * 60 * 60 * 1000)
  }
  return null
}

function applyTimeOffset(date: Date, offset: string): Date {
  const match = offset.match(/^-?(\d+)d$/)
  if (!match) return date
  const days = parseInt(match[1], 10) * (offset.startsWith('-') ? -1 : 1)
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function resolveVariable(value: any, personId: string | null, accountId: string | null): any {
  if (value === '$me') return personId
  if (value === '$account') return accountId
  if (value === '$today') return new Date().toISOString().substring(0, 10)
  return value
}

function applyFilters(
  query: any,
  filters: Record<string, any>,
  personId: string | null,
  accountId: string | null,
): any {
  let q = query
  for (const [key, rawValue] of Object.entries(filters)) {
    const value = resolveVariable(rawValue, personId, accountId)

    if (key === 'stage') {
      // Stage is a join-level filter — handled after fetch via client-side filter
      continue
    }

    if (key.startsWith('custom_field.') || key.startsWith('metadata.')) {
      const metaKey = key.replace('custom_field.', '').replace('metadata.', '')
      q = q.filter(`metadata->>` + metaKey, 'eq', value)
      continue
    }

    if (Array.isArray(value)) {
      q = q.in(key, value)
    } else {
      q = q.eq(key, value)
    }
  }
  return q
}

function groupRows(
  rows: any[],
  groupBy: string,
  aggregate: string,
  filters?: Record<string, any>,
): { group: string; value: number; count: number }[] {
  // Client-side stage filter
  let filtered = rows
  if (filters?.stage) {
    filtered = rows.filter((r: any) => r.stage_definitions?.name === filters.stage)
  }

  if (!groupBy) {
    // No grouping — single aggregate
    const val = computeAggregate(filtered, aggregate)
    return [{ group: '_total', value: val, count: filtered.length }]
  }

  const groups = new Map<string, any[]>()

  for (const row of filtered) {
    let key: string

    if (groupBy.includes('.')) {
      const parts = groupBy.split('.')
      key = String(row[parts[0]]?.[parts[1]] ?? 'Unknown')
    } else if (groupBy.startsWith('created_at:')) {
      const bucket = groupBy.split(':')[1] // day, week, month
      const d = new Date(row.created_at)
      if (bucket === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      } else if (bucket === 'week') {
        const startOfWeek = new Date(d)
        startOfWeek.setDate(d.getDate() - d.getDay())
        key = startOfWeek.toISOString().substring(0, 10)
      } else {
        key = d.toISOString().substring(0, 10)
      }
    } else {
      key = String(row[groupBy] ?? 'Unknown')
    }

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }

  const result: { group: string; value: number; count: number }[] = []
  for (const [group, groupRows] of groups) {
    result.push({
      group,
      value: computeAggregate(groupRows, aggregate),
      count: groupRows.length,
    })
  }

  return result
}

function computeAggregate(rows: any[], aggregate: string): number {
  if (!aggregate || aggregate === 'count') return rows.length

  const match = aggregate.match(/^(sum|avg|min|max):(.+)$/)
  if (!match) return rows.length

  const [, fn, field] = match
  const values = rows
    .map((r) => {
      if (field.startsWith('metadata.')) {
        const key = field.replace('metadata.', '')
        return parseFloat(r.metadata?.[key])
      }
      return parseFloat(r[field])
    })
    .filter((v) => !isNaN(v))

  if (values.length === 0) return 0

  switch (fn) {
    case 'sum': return values.reduce((s, v) => s + v, 0)
    case 'avg': return values.reduce((s, v) => s + v, 0) / values.length
    case 'min': return Math.min(...values)
    case 'max': return Math.max(...values)
    default: return rows.length
  }
}

function sortResult(
  rows: { group: string; value: number; count: number }[],
  sort?: string,
): typeof rows {
  if (!sort) return rows.sort((a, b) => a.group.localeCompare(b.group))

  const [field, dir] = sort.split(':')
  const desc = dir === 'desc'

  return rows.sort((a, b) => {
    const aVal = field === 'value' ? a.value : field === 'count' ? a.count : a.group
    const bVal = field === 'value' ? b.value : field === 'count' ? b.count : b.group
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return desc ? bVal - aVal : aVal - bVal
    }
    return desc ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal))
  })
}

async function executeDataSource(
  body: DataSourceRequest,
  accountId: string,
  personId: string | null,
  timeOverride?: { range?: string; offset?: string },
): Promise<{ rows: any[]; total: number }> {
  const tableName = ALLOWED_ENTITIES[body.entity]
  if (!tableName) throw new Error(`Unknown entity: ${body.entity}`)

  const selectStr = ENTITY_SELECT[body.entity] || '*'
  let query = db.from(tableName).select(selectStr)

  // Scope to account (most tables have account_id)
  if (body.entity !== 'memberships') {
    query = query.eq('account_id', accountId)
  } else {
    query = query.eq('account_id', accountId)
  }

  // Active filter for entities that support it
  if (['items', 'persons', 'entity_links'].includes(body.entity)) {
    query = query.eq('is_active', true)
  }
  if (body.entity === 'memberships') {
    query = query.eq('status', 'active')
  }

  // Apply user-defined filters
  if (body.filters) {
    query = applyFilters(query, body.filters, personId, accountId)
  }

  // Time range
  const effectiveRange = timeOverride?.range || body.time_range
  const fromDate = resolveTimeRange(effectiveRange)
  if (fromDate) {
    let dateStart = fromDate
    if (timeOverride?.offset) {
      dateStart = applyTimeOffset(dateStart, timeOverride.offset)
    }
    query = query.gte('created_at', dateStart.toISOString())

    // If there's a time offset, also cap the end
    if (timeOverride?.offset) {
      const originalFrom = resolveTimeRange(effectiveRange)
      if (originalFrom) {
        query = query.lt('created_at', originalFrom.toISOString())
      }
    }
  }

  // Execute
  const limit = Math.min(body.limit || 1000, 5000)
  const { data, error: dbErr } = await query.limit(limit)
  if (dbErr) throw new Error(dbErr.message)

  const rows = data || []

  // Group + aggregate
  let grouped = groupRows(rows, body.group_by || '', body.aggregate || 'count', body.filters)
  grouped = sortResult(grouped, body.sort)

  if (body.limit && body.limit < grouped.length) {
    grouped = grouped.slice(0, body.limit)
  }

  return { rows: grouped, total: rows.length }
}

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<DataSourceRequest>(req)

    if (!body.entity) {
      return error('entity is required')
    }

    if (!ALLOWED_ENTITIES[body.entity]) {
      return error(`Invalid entity: ${body.entity}. Allowed: ${Object.keys(ALLOWED_ENTITIES).join(', ')}`)
    }

    try {
      const primary = await executeDataSource(body, ctx.accountId!, ctx.personId)

      // Process comparison layers
      const layers: { label: string; rows: any[]; total: number }[] = []
      if (body.layers) {
        for (const layer of body.layers) {
          const layerResult = await executeDataSource(body, ctx.accountId!, ctx.personId, {
            range: layer.time_range,
            offset: layer.time_offset,
          })
          layers.push({ label: layer.label, rows: layerResult.rows, total: layerResult.total })
        }
      }

      return json({
        rows: primary.rows,
        total: primary.total,
        layers: layers.length > 0 ? layers : undefined,
      })
    } catch (err: any) {
      console.error('[widget-data] Error:', err.message)
      return error(err.message, 500)
    }
  },
})
