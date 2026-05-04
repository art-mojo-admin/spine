/**
 * @module src/components/runtime/DataFilters
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Schema-driven filter bar for entity list pages. Renders a control per
 * `EntityFilter` entry:
 * - **`search`** → text input (partial match)
 * - **`enum`** → `<select>` with `All` option + enum values
 * - **`boolean`** → `<select>` with All / Yes / No
 *
 * When `enum` is selected as `'all'`, the key is passed as `undefined` so
 * `useEntityList` omits it from the query string.
 * A "Clear filters" link appears when any filter has a non-empty value.
 *
 * @seeAlso src/types/types.ts (EntityFilter)
 * @seeAlso src/components/runtime/DataListPage.tsx (mounts this component)
 */

import { EntityFilter } from '../../types/types'

/**
 * Props for `DataFilters`.
 *
 * @prop filters - Filter definitions from the list view config
 * @prop values - Current active filter values
 * @prop onChange - Callback with the full updated values map
 * @prop onClear - Callback to reset all filters to `{}`
 */
interface DataFiltersProps {
  filters: EntityFilter[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  onClear: () => void
}

/**
 * Entity list filter bar.
 *
 * @param props - `DataFiltersProps`
 * @returns Filter control bar or null if `filters` is empty
 * @sideEffects none (delegates to `onChange` / `onClear`)
 */
export function DataFilters({ filters, values, onChange, onClear }: DataFiltersProps) {
  const handleFilterChange = (key: string, value: any) => {
    onChange({ ...values, [key]: value })
  }
  
  const hasActiveFilters = Object.values(values).some(v => v !== undefined && v !== '' && v !== 'all')
  
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {filters.map((filter) => (
          <div key={filter.key} className="sm:w-48">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {filter.label}
            </label>
            
            {filter.type === 'search' && (
              <div className="relative">
                <input
                  type="text"
                  value={values[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  placeholder={`Search ${filter.label.toLowerCase()}...`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            
            {filter.type === 'enum' && (
              <select
                value={values[filter.key] || 'all'}
                onChange={(e) => handleFilterChange(filter.key, e.target.value === 'all' ? undefined : e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All {filter.label}</option>
                {filter.options?.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            )}
            
            {filter.type === 'boolean' && (
              <select
                value={values[filter.key]?.toString() || 'all'}
                onChange={(e) => {
                  const value = e.target.value
                  handleFilterChange(filter.key, value === 'all' ? undefined : value === 'true')
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            )}
            
            {/* foreign_key and polymorphic filters would need more complex UI */}
          </div>
        ))}
        
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={onClear}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
