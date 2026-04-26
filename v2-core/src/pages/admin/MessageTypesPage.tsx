import React, { useState } from 'react'
import { 
  PlusIcon,
  EnvelopeIcon,
  CheckCircleIcon,
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

interface MessageType {
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

export function MessageTypesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedOwnership, setSelectedOwnership] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch message types from API (filter by kind='message')
  const { data: messageTypes, loading, error, refetch } = useApi<MessageType[]>(
    async () => {
      const response = await apiFetch('/api/types?kind=message&action=list')
      if (!response.ok) throw new Error('Failed to fetch message types')
      const result = await response.json()
      return (result.data || result) as MessageType[]
    },
    { immediate: true }
  )

  const filteredMessageTypes = (messageTypes || []).filter(messageType => {
    const matchesSearch = messageType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         messageType.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (messageType.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'active' && messageType.is_active) ||
      (selectedStatus === 'inactive' && !messageType.is_active)
    const matchesOwnership = selectedOwnership === 'all' || messageType.ownership === selectedOwnership
    return matchesSearch && matchesStatus && matchesOwnership
  })

  const ownershipTypes = Array.from(new Set((messageTypes || []).map(t => t.ownership)))

  // Helper functions
  const getStatusBadge = (messageType: MessageType) => {
    if (!messageType.is_active) {
      return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-600">Inactive</span>
    }
    if (messageType.ownership === 'system') {
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

  const handleRowClick = (messageType: MessageType) => {
    window.location.href = `/admin/configs/messages/${messageType.id}`
  }

  // Sort message types
  const sortedMessageTypes = [...(filteredMessageTypes || [])].sort((a, b) => {
    let aValue: any = a[sortKey as keyof MessageType]
    let bValue: any = b[sortKey as keyof MessageType]
    
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
      title: 'Total Message Types',
      value: (messageTypes || []).length,
      icon: EnvelopeIcon,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Active',
      value: (messageTypes || []).filter(t => t.is_active).length,
      icon: CheckCircleIcon,
      iconColor: 'text-green-500'
    },
    {
      title: 'System Types',
      value: (messageTypes || []).filter(t => t.ownership === 'system').length,
      icon: CogIcon,
      iconColor: 'text-purple-500'
    },
    {
      title: 'Total Fields',
      value: (messageTypes || []).reduce((sum, t) => sum + Object.keys(t.design_schema?.fields || {}).length, 0),
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
      title="Message Types"
      description="Define message structures and field schemas"
      newButtonText="Add Message Type"
      newButtonHref="/admin/configs/messages/new"
      statsCards={statsCards}
      searchPlaceholder="Search message types..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filters={filters}
      loading={loading}
      error={error}
      emptyMessage="No message types found"
      emptyIcon={EnvelopeIcon}
    >
      {sortedMessageTypes.length === 0 ? (
        <div className="p-8 text-center">
          <EnvelopeIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No message types found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTableHeader
                title="Message Type"
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
            {sortedMessageTypes.map((messageType) => (
              <tr 
                key={messageType.id} 
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(messageType)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-slate-900">
                      <span className="text-accent-blue hover:text-navy">
                        {messageType.name}
                      </span>
                    </div>
                    {messageType.description && (
                      <div className="text-sm text-slate-500">{messageType.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-500 font-mono">{messageType.slug}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(messageType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${
                    messageType.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {messageType.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {Object.keys(messageType.design_schema?.fields || {}).length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDateTime(messageType.created_at)}
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
