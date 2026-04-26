import React, { useState } from 'react'
import { 
  PlusIcon,
  PaperClipIcon,
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

interface AttachmentType {
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

export function AttachmentTypesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedOwnership, setSelectedOwnership] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch attachment types from API (filter by kind='attachment')
  const { data: attachmentTypes, loading, error, refetch } = useApi<AttachmentType[]>(
    async () => {
      const response = await apiFetch('/api/types?kind=attachment&action=list')
      if (!response.ok) throw new Error('Failed to fetch attachment types')
      const result = await response.json()
      return (result.data || result) as AttachmentType[]
    },
    { immediate: true }
  )

  const filteredAttachmentTypes = (attachmentTypes || []).filter(attachmentType => {
    const matchesSearch = attachmentType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         attachmentType.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (attachmentType.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesStatus = selectedStatus === 'all' || 
      (selectedStatus === 'active' && attachmentType.is_active) ||
      (selectedStatus === 'inactive' && !attachmentType.is_active)
    const matchesOwnership = selectedOwnership === 'all' || attachmentType.ownership === selectedOwnership
    return matchesSearch && matchesStatus && matchesOwnership
  })

  const ownershipTypes = Array.from(new Set((attachmentTypes || []).map(t => t.ownership)))

  // Helper functions
  const getStatusBadge = (attachmentType: AttachmentType) => {
    if (!attachmentType.is_active) {
      return <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-600">Inactive</span>
    }
    if (attachmentType.ownership === 'system') {
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

  const handleRowClick = (attachmentType: AttachmentType) => {
    window.location.href = `/admin/configs/attachments/${attachmentType.id}`
  }

  // Sort attachment types
  const sortedAttachmentTypes = [...(filteredAttachmentTypes || [])].sort((a, b) => {
    let aValue: any = a[sortKey as keyof AttachmentType]
    let bValue: any = b[sortKey as keyof AttachmentType]
    
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
      title: 'Total Attachment Types',
      value: (attachmentTypes || []).length,
      icon: PaperClipIcon,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Active',
      value: (attachmentTypes || []).filter(t => t.is_active).length,
      icon: CheckCircleIcon,
      iconColor: 'text-green-500'
    },
    {
      title: 'System Types',
      value: (attachmentTypes || []).filter(t => t.ownership === 'system').length,
      icon: CogIcon,
      iconColor: 'text-purple-500'
    },
    {
      title: 'Total Fields',
      value: (attachmentTypes || []).reduce((sum, t) => sum + Object.keys(t.design_schema?.fields || {}).length, 0),
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
      title="Attachment Types"
      description="Define attachment structures and field schemas"
      newButtonText="Add Attachment Type"
      newButtonHref="/admin/configs/attachments/new"
      statsCards={statsCards}
      searchPlaceholder="Search attachment types..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filters={filters}
      loading={loading}
      error={error}
      emptyMessage="No attachment types found"
      emptyIcon={PaperClipIcon}
    >
      {sortedAttachmentTypes.length === 0 ? (
        <div className="p-8 text-center">
          <PaperClipIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No attachment types found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTableHeader
                title="Attachment Type"
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
            {sortedAttachmentTypes.map((attachmentType) => (
              <tr 
                key={attachmentType.id} 
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(attachmentType)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium text-slate-900">
                      <span className="text-accent-blue hover:text-navy">
                        {attachmentType.name}
                      </span>
                    </div>
                    {attachmentType.description && (
                      <div className="text-sm text-slate-500">{attachmentType.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-500 font-mono">{attachmentType.slug}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(attachmentType)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ${
                    attachmentType.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {attachmentType.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {Object.keys(attachmentType.design_schema?.fields || {}).length}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDateTime(attachmentType.created_at)}
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
