import React, { useState } from 'react'
import { Table, TablePagination, TableColumn } from './Table'
import { Badge } from './Badge'
import { Button } from './Button'
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { cn } from '../../lib/utils'

interface DataTableColumn<T> extends TableColumn<T> {
  filterable?: boolean
  filterOptions?: Array<{ value: string; label: string }>
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  filterable?: boolean
  pagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    onPageChange: (page: number) => void
    onItemsPerPageChange: (itemsPerPage: number) => void
  }
  onSort?: (column: keyof T, direction: 'asc' | 'desc') => void
  sortColumn?: keyof T
  sortDirection?: 'asc' | 'desc'
  onRowClick?: (item: T) => void
  onSearch?: (query: string) => void
  onFilter?: (filters: Record<string, any>) => void
  emptyMessage?: string
  className?: string
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  filterable = true,
  pagination,
  onSort,
  sortColumn,
  sortDirection,
  onRowClick,
  onSearch,
  onFilter,
  emptyMessage = 'No data available',
  className
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  const handleFilter = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value }
    if (value === '' || value === null || value === undefined) {
      delete newFilters[key]
    }
    setFilters(newFilters)
    onFilter?.(newFilters)
  }

  const clearFilters = () => {
    setFilters({})
    onFilter?.({})
  }

  const hasActiveFilters = Object.keys(filters).length > 0
  const hasActiveSearch = searchQuery.length > 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and Filters */}
      {(searchable || filterable) && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            {searchable && (
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-[5px] focus:ring-accent-blue focus:border-accent-blue"
                  />
                </div>
              </div>
            )}

            {/* Filters */}
            {filterable && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    hasActiveFilters && 'bg-blue-50 border-blue-200 text-blue-700'
                  )}
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="info" size="sm">
                      {Object.keys(filters).length}
                    </Badge>
                  )}
                </Button>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && filterable && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {columns
                  .filter(column => column.filterable && column.filterOptions)
                  .map((column) => (
                    <div key={String(column.key)}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {column.title}
                      </label>
                      <select
                        value={filters[String(column.key)] || ''}
                        onChange={(e) => handleFilter(String(column.key), e.target.value || null)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-[5px] focus:ring-accent-blue focus:border-accent-blue"
                      >
                        <option value="">All</option>
                        {column.filterOptions?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active filters display */}
      {(hasActiveFilters || hasActiveSearch) && (
        <div className="flex flex-wrap gap-2">
          {hasActiveSearch && (
            <Badge variant="info" className="flex items-center">
              Search: "{searchQuery}"
              <button
                onClick={() => handleSearch('')}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </Badge>
          )}
          
          {Object.entries(filters).map(([key, value]) => {
            const column = columns.find(col => String(col.key) === key)
            const option = column?.filterOptions?.find(opt => opt.value === value)
            
            return (
              <Badge key={key} variant="info" className="flex items-center">
                {column?.title}: {option?.label || value}
                <button
                  onClick={() => handleFilter(key, null)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </Badge>
            )
          })}
        </div>
      )}

      {/* Table */}
      <Table
        data={data}
        columns={columns}
        loading={loading}
        onSort={onSort}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onRowClick={onRowClick}
        emptyMessage={emptyMessage}
      />

      {/* Pagination */}
      {pagination && (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          itemsPerPage={pagination.itemsPerPage}
          onPageChange={pagination.onPageChange}
          onItemsPerPageChange={pagination.onItemsPerPageChange}
        />
      )}
    </div>
  )
}
