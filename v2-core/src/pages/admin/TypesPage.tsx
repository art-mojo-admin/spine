import React, { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { 
  PlusIcon,
  CubeIcon,
  DocumentTextIcon,
  CalendarIcon,
  CogIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { AdminListPage } from '../../components/admin/AdminListPage'
import { SortableTableHeader } from '../../components/admin/SortableTableHeader'
import { formatDateTime } from '../../lib/utils'

interface Type {
  id: string
  name: string
  slug: string
  kind: string
  description?: string
  icon?: string
  color?: string
  schema: {
    fields: Record<string, {
      type: string
      label?: string
      required?: boolean
      options?: string[]
    }>
  }
  ownership: string
  is_active: boolean
  created_at: string
  updated_at: string
  app_id?: string | null
  app?: any
}

export function TypesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch types from API
  const { data: types, loading, error, refetch } = useApi<Type[]>(
    async ({ signal }: { signal?: AbortSignal }) => {
      const response = await apiFetch('/api/types?action=list', { signal })
      if (!response.ok) throw new Error('Failed to fetch types')
      const result = await response.json()
      return result.data || []
    },
    { immediate: true }
  )

  const categories = [
    { value: 'all', label: 'All Types' },
    { value: 'system', label: 'System Types' },
    { value: 'custom', label: 'Custom Types' },
    { value: 'active', label: 'Active Only' },
  ]

  const filteredTypes = (types || []).filter(type => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (type.description && type.description.toLowerCase().includes(searchTerm.toLowerCase()))
    
    let matchesCategory = true
    if (selectedCategory === 'system') {
      matchesCategory = type.ownership === 'system'
    } else if (selectedCategory === 'custom') {
      matchesCategory = type.ownership !== 'system'
    } else if (selectedCategory === 'active') {
      matchesCategory = type.is_active
    }
    
    return matchesSearch && matchesCategory
  })

  // Helper functions
  const getCategoryBadgeColor = (type: Type) => {
    if (type.ownership === 'system') {
      return 'bg-purple-100 text-purple-700'
    }
    return 'bg-accent-blue/10 text-accent-blue'
  }

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-700'
      : 'bg-slate-100 text-slate-600'
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (type: Type) => {
    window.location.href = `/admin/configs/types/${type.id}`
  }

  // Sort types
  const sortedTypes = [...(filteredTypes || [])].sort((a, b) => {
    let aValue: any = a[sortKey as keyof Type]
    let bValue: any = b[sortKey as keyof Type]
    
    if (typeof aValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    return 0
  })

  const statsCards = [
    {
      title: 'Total Types',
      value: (types || []).length,
      icon: CogIcon,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Custom Types',
      value: (types || []).filter(t => t.ownership !== 'system').length,
      icon: CubeIcon,
      iconColor: 'text-green-500'
    },
    {
      title: 'Active Types',
      value: (types || []).filter(t => t.is_active).length,
      icon: CheckCircleIcon,
      iconColor: 'text-orange-500'
    },
    {
      title: 'Total Fields',
      value: (types || []).reduce((sum, t) => sum + Object.keys(t.schema?.fields || {}).length, 0),
      icon: DocumentTextIcon,
      iconColor: 'text-purple-500'
    }
  ]

  const filters = [
    {
      label: 'Category',
      value: selectedCategory,
      options: categories,
      onChange: setSelectedCategory
    }
  ]

  return (
    <AdminListPage
      title="Types"
      description="Manage item types and their schemas"
      newButtonText="New Type"
      newButtonHref="/admin/configs/types/new"
      statsCards={statsCards}
      searchPlaceholder="Search types..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filters={filters}
      loading={loading}
      error={error}
      onRetry={refetch}
      emptyMessage="No types found"
      emptyIcon={CogIcon}
    >
      {sortedTypes.length === 0 ? (
        <div className="p-8 text-center">
          <CogIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No types found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTableHeader
                title="Type"
                sortKey="name"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Category"
                sortKey="ownership"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Status"
                sortKey="is_active"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Fields"
                sortKey="schema"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Created"
                sortKey="created_at"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sortedTypes.map((type) => (
              <tr 
                key={type.id} 
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(type)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-slate-900">
                      <span className="text-accent-blue hover:text-navy">
                        {type.name}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {type.description || type.slug}
                      <span className="mx-1.5 text-slate-300">&middot;</span>
                      {Object.keys(type.schema?.fields || {}).length} fields
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${getCategoryBadgeColor(type)}`}>
                    {type.ownership === 'system' ? 'System' : 'Custom'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${getStatusBadgeColor(type.is_active)}`}>
                    {type.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {Object.keys(type.schema?.fields || {}).length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDateTime(type.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-slate-400">→</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminListPage>
  )
}
