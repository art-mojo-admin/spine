import React, { useState } from 'react'
import { 
  PlusIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { AdminListPage } from '../../components/admin/AdminListPage'
import { SortableTableHeader } from '../../components/admin/SortableTableHeader'
import { formatDateTime } from '../../lib/utils'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'

interface AccountType {
  id: string
  name: string
  slug: string
  kind: string
  description?: string
  icon?: string
  color?: string
  schema: {
    fields: Record<string, any>
  }
  ownership: string
  is_active: boolean
  app_id?: string
  app?: any
  created_at: string
  updated_at: string
}

export function AccountTypesPage() {
  console.log('AccountTypesPage rendering...')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedOwnership, setSelectedOwnership] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch account types from API (filter by kind='account')
  const { data: allTypes, loading, error, refetch } = useApi<AccountType[]>(
    async ({ signal }: { signal?: AbortSignal }) => {
      try {
        console.log('Fetching account types...')
        const response = await apiFetch('/api/types?kind=account&is_active=true&action=list', { signal })
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          console.error('Response not ok:', response.statusText)
          throw new Error(`Failed to fetch account types: ${response.statusText}`)
        }
        
        const result = await response.json()
        console.log('API result:', result)
        
        // Handle both nested and direct responses
        const types = result.data || result
        console.log('Types before filter:', types)
        
        const accountTypes = types.filter((type: AccountType) => type.kind === 'account') || []
        console.log('Account types after filter:', accountTypes)
        
        return accountTypes
      } catch (error) {
        console.error('Error in AccountTypesPage:', error)
        throw error
      }
    },
    { immediate: true }
  )

  const filteredAccountTypes = (allTypes || []).filter(accountType => {
    const matchesSearch = accountType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         accountType.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (accountType.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'active' && accountType.is_active) ||
      (selectedStatus === 'inactive' && !accountType.is_active)
    const matchesOwnership = selectedOwnership === 'all' || accountType.ownership === selectedOwnership
    return matchesSearch && matchesStatus && matchesOwnership
  })

  console.log('AccountTypesPage - allTypes:', allTypes)
  console.log('AccountTypesPage - filteredAccountTypes:', filteredAccountTypes)

  const ownershipTypes = Array.from(new Set((allTypes || []).map(t => t.ownership)))

  // Helper functions
  const getStatusBadge = (accountType: AccountType) => {
    if (!accountType.is_active) {
      return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-600">Inactive</span>
    }
    if (accountType.ownership === 'system') {
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

  const handleRowClick = (accountType: AccountType) => {
    window.location.href = `/admin/configs/accounts/${accountType.id}`
  }

  // Sort account types
  const sortedAccountTypes = [...(filteredAccountTypes || [])].sort((a, b) => {
    let aValue: any = a[sortKey as keyof AccountType]
    let bValue: any = b[sortKey as keyof AccountType]
    
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
      title: 'Total Account Types',
      value: (allTypes || []).length,
      icon: CubeIcon,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Active',
      value: (allTypes || []).filter(t => t.is_active).length,
      icon: CheckCircleIcon,
      iconColor: 'text-green-500'
    },
    {
      title: 'System Types',
      value: (allTypes || []).filter(t => t.ownership === 'system').length,
      icon: CogIcon,
      iconColor: 'text-purple-500'
    },
    {
      title: 'Total Fields',
      value: (allTypes || []).reduce((sum, t) => sum + Object.keys(t.schema?.fields || {}).length, 0),
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
      title="Account Types"
      description="Define account structures and field schemas"
      newButtonText="Add Account Type"
      newButtonHref="/admin/configs/accounts/new"
      statsCards={statsCards}
      searchPlaceholder="Search account types..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filters={filters}
      loading={loading}
      error={error}
      emptyMessage="No account types found"
      emptyIcon={CubeIcon}
    >
      {sortedAccountTypes.length === 0 ? (
        <div className="p-8 text-center">
          <CubeIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No account types found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTableHeader
                title="Account Type"
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
            {sortedAccountTypes.map((accountType) => (
              <tr 
                key={accountType.id} 
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(accountType)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-slate-900">
                      <span className="text-accent-blue hover:text-navy">
                        {accountType.name}
                      </span>
                    </div>
                    {accountType.description && (
                      <div className="text-sm text-slate-500">{accountType.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-500 font-mono">{accountType.slug}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(accountType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${
                    accountType.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {accountType.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {Object.keys(accountType.schema?.fields || {}).length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDateTime(accountType.created_at)}
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
