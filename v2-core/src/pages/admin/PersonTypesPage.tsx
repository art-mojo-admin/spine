import React, { useState } from 'react'
import { 
  PlusIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { AdminListPage } from '../../components/admin/AdminListPage'
import { SortableTableHeader } from '../../components/admin/SortableTableHeader'
import { formatDateTime } from '../../lib/utils'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'

interface PersonType {
  id: string
  name: string
  slug: string
  kind: string
  description?: string
  icon?: string
  color?: string
  design_schema?: {
    fields: Record<string, any>
  }
  ownership: string
  is_active: boolean
  app_id?: string
  app?: any
  created_at: string
  updated_at: string
}

export function PersonTypesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedOwnership, setSelectedOwnership] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch person types from API (filter by kind='person')
  const { data: personTypes, loading, error, refetch } = useApi<PersonType[]>(
    async () => {
      const response = await apiFetch('/api/types?kind=person&action=list')
      if (!response.ok) throw new Error('Failed to fetch person types')
      const result = await response.json()
      return (result.data || result) as PersonType[]
    },
    { immediate: true }
  )

  const filteredPersonTypes = (personTypes || []).filter(personType => {
    const matchesSearch = personType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         personType.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (personType.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'active' && personType.is_active) ||
      (selectedStatus === 'inactive' && !personType.is_active)
    const matchesOwnership = selectedOwnership === 'all' || personType.ownership === selectedOwnership
    return matchesSearch && matchesStatus && matchesOwnership
  })

  const ownershipTypes = Array.from(new Set((personTypes || []).map(t => t.ownership)))

  // Helper functions
  const getStatusBadge = (personType: PersonType) => {
    if (!personType.is_active) {
      return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-600">Inactive</span>
    }
    if (personType.ownership === 'system') {
      return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-green-100 text-green-700">System</span>
    }
    return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-blue-100 text-blue-700">Custom</span>
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (personType: PersonType) => {
    window.location.href = `/admin/configs/people/${personType.id}`
  }

  // Sort person types
  const sortedPersonTypes = [...(filteredPersonTypes || [])].sort((a, b) => {
    let aValue: any = a[sortKey as keyof PersonType]
    let bValue: any = b[sortKey as keyof PersonType]
    
    if (typeof aValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'boolean') {
      return sortDirection === 'asc' ? (aValue ? 1 : 0) : (bValue ? 1 : 0)
    }
    
    return 0
  })

  const statsCards = [
    {
      title: 'Total Person Types',
      value: (personTypes || []).length,
      icon: UserIcon,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Active',
      value: (personTypes || []).filter(t => t.is_active).length,
      icon: CheckCircleIcon,
      iconColor: 'text-green-500'
    },
    {
      title: 'System Types',
      value: (personTypes || []).filter(t => t.ownership === 'system').length,
      icon: CogIcon,
      iconColor: 'text-purple-500'
    },
    {
      title: 'Total Fields',
      value: (personTypes || []).reduce((sum, t) => sum + Object.keys(t.design_schema?.fields || {}).length, 0),
      icon: DocumentTextIcon,
      iconColor: 'text-orange-500'
    }
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]

  const ownershipOptions = [
    { value: 'all', label: 'All Ownership' },
    ...ownershipTypes.map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))
  ]

  const filters = [
    {
      label: 'Status',
      value: selectedStatus,
      options: statusOptions,
      onChange: setSelectedStatus
    },
    {
      label: 'Ownership',
      value: selectedOwnership,
      options: ownershipOptions,
      onChange: setSelectedOwnership
    }
  ]

  return (
    <AdminListPage
      title="Person Types"
      description="Define person structures and field schemas"
      newButtonText="Add Person Type"
      newButtonHref="/admin/configs/people/new"
      statsCards={statsCards}
      searchPlaceholder="Search person types..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filters={filters}
      loading={loading}
      error={error}
      emptyMessage="No person types found"
      emptyIcon={UserIcon}
    >
      {sortedPersonTypes.length === 0 ? (
        <div className="p-8 text-center">
          <UserIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No person types found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTableHeader
                title="Person Type"
                sortKey="name"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Slug"
                sortKey="slug"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Ownership"
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
            {sortedPersonTypes.map((personType) => (
              <tr 
                key={personType.id} 
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(personType)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-slate-900">
                      <span className="text-accent-blue hover:text-navy">
                        {personType.name}
                      </span>
                    </div>
                    {personType.description && (
                      <div className="text-sm text-slate-500">{personType.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-500 font-mono">{personType.slug}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(personType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${
                    personType.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {personType.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {Object.keys(personType.design_schema?.fields || {}).length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDateTime(personType.created_at)}
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
