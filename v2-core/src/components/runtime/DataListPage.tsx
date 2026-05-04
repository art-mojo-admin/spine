/**
 * @module src/components/runtime/DataListPage
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Schema-driven entity list page. Renders any entity list by reading the
 * `entity` route param, resolving its `DesignSchema` via `useListSchema`,
 * and wiring the result into `useEntityList`.
 *
 * **Route:** `/spine-framework/admin/runtime/:entity` (optional `:typeSlug` param for
 * type-scoped lists)
 *
 * **Rendering pipeline:**
 * 1. `useListSchema` resolves `schema` + `view` (may involve 1–2 API calls)
 * 2. A minimal `config` object is constructed from `view` data
 * 3. `useEntityList(entity, config)` fetches the paginated list
 * 4. Sub-components (`DataHeader`, `DataStats`, `DataFilters`, `DataTable`)
 *    render sections independently with their own loading/error states
 *
 * @seeAlso src/hooks/useListSchema.ts
 * @seeAlso src/hooks/useEntityList.ts
 * @seeAlso src/components/runtime/DataTable.tsx
 */

import { useParams } from 'react-router-dom'
import { useListSchema } from '../../hooks/useListSchema'
import { useEntityList } from '../../hooks/useEntityList'
import { DataHeader } from './DataHeader'
import { DataStats } from './DataStats'
import { DataFilters } from './DataFilters'
import { DataTable } from './DataTable'

/**
 * Schema-driven list page. Reads `:entity` from the URL, resolves schema,
 * and renders the full list UI.
 *
 * @returns Full list page or a loading/error fallback
 * @sideEffects Network requests via useListSchema + useEntityList
 */
export function DataListPage() {
  const { entity, typeSlug } = useParams<{ entity: string; typeSlug?: string }>()
  
  const { schema, view, loading: schemaLoading, error: schemaError } = useListSchema({
    entity: entity || '',
    viewSlug: 'default_list'
  })
  
  // Create a minimal config for useEntityList based on schema
  const config = view && schema ? {
    entity: entity || '',
    typeSlug: typeSlug || undefined,
    icon: 'database',
    api: {
      endpoint: 'admin-data',
      listAction: 'list'
    },
    list: {
      defaultSort: (view as any).default_sort || { field: 'created_at', direction: 'desc' },
      stats: (view as any).stats || [],
      filters: (view as any).filters || [],
      columns: Object.entries((view as any).fields || {}).map(([key, fieldConfig]: [string, any]) => ({
        key,
        label: schema.fields[key]?.label || key,
        sortable: fieldConfig.sortable !== false,
        display_type: fieldConfig.display_type
      }))
    }
  } : null
  
  // Always call useEntityList hook, but pass null config when not ready
  const { 
    data, 
    loading, 
    error, 
    refetch,
    filters, 
    setFilters, 
    sort, 
    setSort
  } = useEntityList(entity!, config)
  
  if (schemaLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-slate-500">Loading schema...</p>
      </div>
    )
  }
  
  if (schemaError || !config) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-medium text-red-600">Error</h2>
        <p className="mt-2 text-sm text-slate-500">{schemaError || 'Failed to load entity configuration'}</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <DataHeader 
        title={config.entity}
        icon={config.icon}
        description={`Manage ${config.entity}`}
        newButtonHref={`/spine-framework/admin/runtime/${entity}/new`}
      />
      
      <DataStats 
        stats={config.list.stats} 
        data={data}
        loading={loading}
      />
      
      <DataFilters 
        filters={config.list.filters}
        values={filters}
        onChange={setFilters}
        onClear={() => setFilters({})}
      />
      
      <DataTable 
        columns={config.list.columns}
        data={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        sort={sort}
        onSort={setSort}
        entity={entity!}
        emptyMessage={`No ${config.entity} found`}
        emptyIcon={config.icon}
      />
    </div>
  )
}
