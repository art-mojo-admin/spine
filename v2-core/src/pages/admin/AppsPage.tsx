import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { formatDateTime } from '../../lib/utils'
import { 
  PlusIcon,
  CubeIcon,
  DocumentTextIcon,
  CalendarIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { AdminListPage } from '../../components/admin/AdminListPage'
import { SortableTableHeader } from '../../components/admin/SortableTableHeader'

interface App {
  id: string
  slug: string
  name: string
  description?: string
  app_type: string
  version: string
  config: Record<string, any>
  is_active: boolean
  is_public: boolean
  created_at: string
  updated_at: string
  created_by: string
  account_id: string
  account_name: string
  item_count: number
  user_count: number
}

export function AppsPage() {
  console.log('AppsPage rendering...')
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Fetch apps from API
  const { data: apps, loading, error, refetch } = useApi<App[]>(
    async ({ signal }: { signal?: AbortSignal }) => {
      try {
        console.log('Fetching apps...')
        const response = await apiFetch('/api/apps?action=list', { signal })
        console.log('Response status:', response.status)
        
        if (!response.ok) {
          console.error('Response not ok:', response.statusText)
          throw new Error(`Failed to fetch apps: ${response.statusText}`)
        }
        
        const result = await response.json()
        console.log('API result:', result)
        
        // Handle both nested and direct responses
        const apps = result.data || result
        console.log('Apps after processing:', apps)
        
        return apps
      } catch (error) {
        console.error('Error in AppsPage:', error)
        throw error
      }
    },
    { immediate: true }
  )

  const appTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'core', label: 'Core Apps' },
    { value: 'custom', label: 'Custom Apps' },
    { value: 'marketplace', label: 'Marketplace' }
  ]

  const filteredApps = (apps || []).filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (app.description && app.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = selectedType === 'all' || app.app_type === selectedType
    const matchesStatus = selectedStatus === 'all' || app.is_active === (selectedStatus === 'active')
    return matchesSearch && matchesType && matchesStatus
  })

  console.log('AppsPage - apps:', apps)
  console.log('AppsPage - filteredApps:', filteredApps)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'core':
        return <CubeIcon className="h-5 w-5 text-blue-500" />
      case 'custom':
        return <DocumentTextIcon className="h-5 w-5 text-green-500" />
      case 'marketplace':
        return <CubeIcon className="h-5 w-5 text-purple-500" />
      default:
        return <CubeIcon className="h-5 w-5 text-slate-500" />
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'core':
        return 'info'
      case 'custom':
        return 'success'
      case 'marketplace':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusBadgeVariant = (isActive: boolean, isPublic: boolean) => {
    if (!isActive) return 'default'
    if (isPublic) return 'success'
    return 'info'
  }

  const getStatusText = (isActive: boolean, isPublic: boolean) => {
    if (!isActive) {
      return 'Inactive'
    }
    if (isPublic) {
      return 'Public'
    }
    return 'Private'
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (app: App) => {
    navigate(`/admin/configs/apps/${app.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner className="w-6 h-6" />
      </div>
    )
  }

  if (error) {
    console.error('AppsPage error:', error)
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-semibold">Failed to load apps</div>
        <div className="mt-1">Error: {String(error)}</div>
        <div className="mt-2 text-xs">
          Check the browser console for more details.
        </div>
      </div>
    )
  }

  // Sort apps
  const sortedApps = [...(filteredApps || [])].sort((a, b) => {
    let aValue: any = a[sortKey as keyof App]
    let bValue: any = b[sortKey as keyof App]
    
    if (typeof aValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    if (typeof aValue === 'boolean') {
      return sortDirection === 'asc' ? (aValue ? 1 : 0) : (bValue ? 1 : 0)
    }
    
    return 0
  })

  const statsCards = [
    {
      title: 'Total Apps',
      value: (apps || []).length,
      icon: CubeIcon,
      iconColor: 'text-blue-500'
    },
    {
      title: 'Active Apps',
      value: (apps || []).filter(a => a.is_active).length,
      icon: CheckCircleIcon,
      iconColor: 'text-green-500'
    },
    {
      title: 'Total Items',
      value: (apps || []).reduce((sum, app) => sum + (app.item_count || 0), 0),
      icon: DocumentTextIcon,
      iconColor: 'text-purple-500'
    },
    {
      title: 'Total Users',
      value: (apps || []).reduce((sum, app) => sum + (app.user_count || 0), 0),
      icon: CalendarIcon,
      iconColor: 'text-orange-500'
    }
  ]

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...appTypes.map(type => ({ value: type.value, label: type.label }))
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]

  const filters = [
    {
      label: 'Type',
      value: selectedType,
      options: typeOptions,
      onChange: setSelectedType
    },
    {
      label: 'Status',
      value: selectedStatus,
      options: statusOptions,
      onChange: setSelectedStatus
    }
  ]

  return (
    <AdminListPage
      title="Apps"
      description="Manage applications and their configurations"
      newButtonText="New App"
      newButtonHref="/admin/configs/apps/new"
      statsCards={statsCards}
      searchPlaceholder="Search apps..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      filters={filters}
      loading={loading}
      error={error}
      emptyMessage="No apps found"
      emptyIcon={CubeIcon}
    >
      {sortedApps.length === 0 ? (
        <div className="p-8 text-center">
          <CubeIcon className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No apps found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <SortableTableHeader
                title="App"
                sortKey="name"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Type"
                sortKey="app_type"
                currentSortKey={sortKey}
                currentSortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableTableHeader
                title="Version"
                sortKey="version"
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
                title="Resources"
                sortKey="item_count"
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
            {sortedApps.map((app) => (
              <tr 
                key={app.id} 
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleRowClick(app)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getTypeIcon(app.app_type)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-slate-900">
                        <span className="text-accent-blue hover:text-navy">
                          {app.name}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">
                        {app.slug}
                      </div>
                      {app.description && (
                        <div className="text-xs text-slate-400 mt-1">
                          {app.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getTypeBadgeVariant(app.app_type)}>
                    {app.app_type}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {app.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getStatusBadgeVariant(app.is_active, app.is_public)}>
                    {getStatusText(app.is_active, app.is_public)}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  <div className="flex flex-col">
                    <span>{app.item_count} items</span>
                    <span>{app.user_count} users</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {formatDateTime(app.created_at)}
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
