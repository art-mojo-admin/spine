/**
 * @module src/components/admin/SortableTableHeader
 * @audience installer
 * @layer frontend-component
 * @stability stable
 *
 * A `<th>` element that displays a sort indicator and calls `onSort` when
 * clicked. Used in hardcoded admin table headers where sort state is
 * managed by the parent page component.
 *
 * **Sort indicator logic:**
 * - No indicator shown when this column is not the active sort key
 * - `ChevronUpIcon` when sorted ascending
 * - `ChevronDownIcon` when sorted descending
 *
 * **Direction toggling is NOT handled here** — the parent's `onSort`
 * callback is responsible for toggling direction when the same key is
 * clicked twice (see `useEntityList` or similar).
 *
 * @seeAlso src/components/runtime/DataTable.tsx (runtime equivalent with toggle)
 */

import React from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

/**
 * Props for `SortableTableHeader`.
 *
 * @prop title - Column header label
 * @prop sortKey - The field name to pass to `onSort`
 * @prop currentSortKey - The field currently sorted on (for indicator visibility)
 * @prop currentSortDirection - Active sort direction
 * @prop onSort - Callback invoked with `sortKey` on click
 * @prop className - Additional Tailwind classes for the `<th>` element
 */
interface SortableTableHeaderProps {
  title: string
  sortKey: string
  currentSortKey?: string
  currentSortDirection?: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

/**
 * Sortable `<th>` element with active-column indicator.
 *
 * @param props - `SortableTableHeaderProps`
 * @returns A `<th>` element; clicking it fires `onSort(sortKey)`
 * @sideEffects none (delegates to `onSort`)
 */
export function SortableTableHeader({
  title,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className = ""
}: SortableTableHeaderProps) {
  const isSorted = currentSortKey === sortKey
  const isAscending = currentSortDirection === 'asc'
  
  return (
    <th
      className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{title}</span>
        {isSorted && (
          <span className="inline-flex">
            {isAscending ? (
              <ChevronUpIcon className="h-4 w-4 text-slate-700" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-slate-700" />
            )}
          </span>
        )}
      </div>
    </th>
  )
}
