import { createHandler, requireAuth, requireTenant, json, error, parseBody } from './_shared/middleware'
import { db } from './_shared/db'

// Resolve $me placeholder in filter values
function resolveFilters(filters: Record<string, any>, personId: string | null): Record<string, any> {
  const resolved: Record<string, any> = {}
  for (const [key, value] of Object.entries(filters)) {
    resolved[key] = value === '$me' ? personId : value
  }
  return resolved
}

export default createHandler({
  async POST(req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const body = await parseBody<{
      widget_type: string
      config: Record<string, any>
    }>(req)

    if (!body.widget_type || !body.config) {
      return error('widget_type and config are required')
    }

    const { widget_type, config } = body
    const filters = resolveFilters(config.filter || {}, ctx.personId)

    try {
      switch (widget_type) {
        case 'metric': {
          const entityType = config.entity_type || 'workflow_items'
          let query = db.from(entityType).select('id', { count: 'exact', head: true }).eq('account_id', ctx.accountId)
          for (const [key, value] of Object.entries(filters)) {
            if (typeof value === 'string' && value.startsWith('!')) {
              query = query.neq(key, value.slice(1))
            } else {
              query = query.eq(key, value)
            }
          }
          const { count } = await query
          return json({ value: count || 0, label: config.label || entityType })
        }

        case 'table': {
          const entityType = config.entity_type || 'workflow_items'
          const columns = config.columns?.join(', ') || '*'
          const limit = config.limit || 20
          let query = db.from(entityType).select(columns).eq('account_id', ctx.accountId)
          for (const [key, value] of Object.entries(filters)) {
            if (typeof value === 'string' && value.startsWith('!')) {
              query = query.neq(key, value.slice(1))
            } else {
              query = query.eq(key, value)
            }
          }
          const { data } = await query.order('created_at', { ascending: false }).limit(limit)
          return json({ rows: data || [], total: data?.length || 0 })
        }

        case 'pipeline': {
          const workflowId = config.workflow_definition_id
          if (!workflowId) return error('workflow_definition_id required for pipeline widget')

          const [{ data: stages }, { data: items }] = await Promise.all([
            db.from('stage_definitions').select('id, name, position, is_terminal').eq('workflow_definition_id', workflowId).order('position'),
            db.from('workflow_items').select('id, title, priority, stage_definition_id, owner_person_id').eq('account_id', ctx.accountId).eq('workflow_definition_id', workflowId),
          ])

          // Apply filters to items
          let filteredItems = items || []
          for (const [key, value] of Object.entries(filters)) {
            filteredItems = filteredItems.filter((item: any) => item[key] === value)
          }

          // Group by stage
          const grouped = (stages || []).map((stage: any) => ({
            ...stage,
            items: filteredItems.filter((item: any) => item.stage_definition_id === stage.id),
          }))

          return json({ stages: grouped })
        }

        case 'chart': {
          const entityType = config.entity_type || 'workflow_items'
          const groupBy = config.group_by || 'priority'
          let query = db.from(entityType).select(`${groupBy}`).eq('account_id', ctx.accountId)
          for (const [key, value] of Object.entries(filters)) {
            if (typeof value === 'string' && value.startsWith('!')) {
              query = query.neq(key, value.slice(1))
            } else {
              query = query.eq(key, value)
            }
          }
          const { data } = await query.limit(1000)
          // Count by group
          const counts: Record<string, number> = {}
          for (const row of data || []) {
            const key = (row as any)[groupBy] || 'unknown'
            counts[key] = (counts[key] || 0) + 1
          }
          const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }))
          return json({ data: chartData, chart_type: config.chart_type || 'bar' })
        }

        case 'activity_feed': {
          const limit = config.limit || 10
          let query = db.from('activity_events').select('id, event_type, summary, entity_type, entity_id, created_at').eq('account_id', ctx.accountId)
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value)
          }
          const { data } = await query.order('created_at', { ascending: false }).limit(limit)
          return json({ events: data || [] })
        }

        default:
          return error(`Unknown widget type: ${widget_type}`)
      }
    } catch (err: any) {
      return error(`Widget query failed: ${err.message}`, 500)
    }
  },
})
