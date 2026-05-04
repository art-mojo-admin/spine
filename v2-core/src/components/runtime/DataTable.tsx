/**
 * @module src/components/runtime/DataTable
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * Schema-driven sortable data table for entity list pages. Renders an
 * HTML table from a `columns` + `data` pair with:
 * - **Sortable headers** — clicking a sortable column toggles `asc`/`desc`;
 *   active direction indicated by Heroicon chevron
 * - **Cell rendering** — supports `timestamp` (via `formatDateTime`),
 *   `badge` (colour map), `maxLength` truncation, and plain string fallback
 * - **Row navigation** — clicking any row navigates to
 *   `/spine-framework/admin/runtime/:entity/:id`
 * - **State overlays** — loading spinner, error+retry, and empty state
 *
 * @seeAlso src/types/types.ts (EntityColumn)
 * @seeAlso src/lib/utils.ts (formatDateTime)
 * @seeAlso src/components/runtime/DataListPage.tsx (mounts this component)
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { EntityColumn } from '../../types/types'
import { formatDateTime } from '../../lib/utils'
import * as Icons from '@heroicons/react/24/outline'

/**
 * Props for `DataTable`.
 *
 * @prop columns - Column definitions (key, label, sortable, type, badgeColors, maxLength)
 * @prop data - Row data array
 * @prop loading - Shows spinner when true
 * @prop error - Shows error message when set
 * @prop onRetry - Callback for the "Retry" link shown on error
 * @prop sort - Current sort state (field + direction)
 * @prop onSort - Callback to update sort state
 * @prop entity - Entity name for row navigation URL
 * @prop emptyMessage - Text shown when `data` is empty
 * @prop emptyIcon - Heroicon name for the empty state illustration
 */
interface DataTableProps {
  columns: EntityColumn[]
  data: any[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  sort: { field: string; direction: 'asc' | 'desc' }
  onSort: (sort: { field: string; direction: 'asc' | 'desc' }) => void
  entity: string
  emptyMessage: string
  emptyIcon: string
}

/**
 * Sortable data table with loading, error, and empty states.
 *
 * @param props - `DataTableProps`
 * @returns Table JSX or state overlay
 * @sideEffects Navigates to detail page on row click
 */
export function DataTable({ 
  columns, 
  data, 
  loading, 
  error, 
  onRetry,
  sort,
  onSort,
  entity,
  emptyMessage,
  emptyIcon 
}: DataTableProps) {
  const navigate = useNavigate()
  const EmptyIconComponent = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[emptyIcon] || Icons.CubeIcon
  
  const handleSort = (key: string) => {
    if (sort.field === key) {
      onSort({ 
        field: key, 
        direction: sort.direction === 'asc' ? 'desc' : 'asc' 
      })
    } else {
      onSort({ field: key, direction: 'asc' })
    }
  }
  
  const getSortIcon = (key: string) => {
    if (sort.field !== key) {
      return <Icons.ChevronUpDownIcon className="h-4 w-4 text-slate-400" />
    }
    return sort.direction === 'asc' 
      ? <Icons.ChevronUpIcon className="h-4 w-4 text-blue-600" />
      : <Icons.ChevronDownIcon className="h-4 w-4 text-blue-600" />
  }
  
  const renderCell = (column: EntityColumn, row: any) => {
    const value = column.key.includes('.')
      ? column.key.split('.').reduce((obj, k) => obj?.[k], row)
      : row[column.key]
    
    if (column.type === 'timestamp' && value) {
      return formatDateTime(value)
    }
    
    if (column.type === 'badge' && column.badgeColors) {
      const colorClass = column.badgeColors[value?.toString()] || 'bg-gray-100 text-gray-800'
      return (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
          {value?.toString() || 'Unknown'}
        </span>
      )
    }
    
    if (column.maxLength && typeof value === 'string' && value.length > column.maxLength) {
      return value.substring(0, column.maxLength) + '...'
    }
    
    return value?.toString() || '-'
  }
  
  const handleRowClick = (row: any) => {
    navigate(`/spine-framework/admin/runtime/${entity}/${row.id}`)
  }
  
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-sm text-slate-600">Loading...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <p className="text-red-600">Error: {error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
          >
            Retry
          </button>
        )}
      </div>
    )
  }
  
  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <EmptyIconComponent className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">{emptyMessage}</h3>
        <p className="mt-1 text-sm text-slate-500">
          Try adjusting your filters or create a new record
        </p>
      </div>
    )
  }
  
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${
                  column.sortable ? 'cursor-pointer hover:bg-slate-100' : ''
                }`}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-1">
                  {column.label}
                  {column.sortable && getSortIcon(column.key)}
                </div>
              </th>
            ))}
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {data.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-slate-50 cursor-pointer transition-colors"
              onClick={() => handleRowClick(row)}
            >
              {columns.map((column) => (
                <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {renderCell(column, row)}
                </td>
              ))}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <span className="text-slate-400">→</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
