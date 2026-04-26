import React from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface SortableTableHeaderProps {
  title: string
  sortKey: string
  currentSortKey?: string
  currentSortDirection?: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}

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
