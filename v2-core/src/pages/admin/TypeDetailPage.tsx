import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { useMutation } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'
import { 
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { formatDateTime } from '../../lib/utils'

interface Type {
  id: string
  name: string
  slug: string
  kind: string
  description?: string
  icon?: string
  color?: string
  design_schema?: {
    fields: Record<string, any>
    record_permissions?: Record<string, string[]>
  }
  ownership: string
  is_active: boolean
  app_id?: string
  app?: any
  created_at: string
  updated_at: string
}

interface TypeItem {
  id: string
  item_type_id: string
  data: Record<string, any>
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string
  account_id: string
}

export function TypeDetailPage() {
  const { id, kind } = useParams<{ id: string, kind: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  // Default kind for create mode if not provided
  const typeKind = kind || 'item'
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>({
    name: '',
    slug: '',
    description: '',
    icon: '',
    color: '',
    kind: typeKind,
    schema: { fields: {} },
    ownership: 'app',
    app_id: '',
    is_active: true
  })
  const [schemaText, setSchemaText] = useState(JSON.stringify({ fields: {} }, null, 2))
  const [availableApps, setAvailableApps] = useState<Array<{id: string, name: string}>>([])

  // Fetch available apps for dropdown
  React.useEffect(() => {
    const fetchApps = async () => {
      try {
        const response = await apiFetch('/api/apps?action=list')
        if (response.ok) {
          const data = await response.json()
          setAvailableApps(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching apps:', error)
      }
    }
    fetchApps()
  }, [])

  // Get kind-specific defaults
  const getKindDefaults = () => {
    switch (typeKind) {
      case 'account':
        return { kind: 'account', ownership: 'app', icon: 'building-office', color: 'green' }
      case 'person':
        return { kind: 'person', ownership: 'app', icon: 'user', color: 'purple' }
      default:
        return { kind: 'item', ownership: 'app', icon: 'cube', color: 'blue' }
    }
  }

  // Fetch type details
  const { data: type, loading, error, refetch } = useApi<Type>(
    async () => {
      if (isCreateMode) {
        // Return empty type for create mode with kind-specific defaults
        const defaults = getKindDefaults()
        return {
          id: '',
          name: '',
          slug: '',
          description: '',
          icon: defaults.icon,
          color: defaults.color,
          kind: defaults.kind,
          design_schema: { fields: {} },
          ownership: defaults.ownership,
          app_id: '', // Will be populated from apps dropdown
          is_active: true,
          created_at: '',
          updated_at: ''
        }
      } else {
        // Validate UUID format for edit mode
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!id || !uuidRegex.test(id)) {
          throw new Error('Invalid ID format')
        }
        
        const response = await apiFetch(`/api/types?action=get&id=${id}`)
        if (!response.ok) {
          throw new Error(response.status === 500 ? 'Type not found' : 'Failed to fetch type')
        }
        const json = await response.json()
        return json.data as Type
      }
    },
    { immediate: true }
  )

  // Initialize edit data when type loads
  React.useEffect(() => {
    if (type) {
      setEditData({
        name: type.name,
        slug: type.slug,
        description: type.description || '',
        icon: type.icon || '',
        color: type.color || '',
        kind: type.kind || 'item',
        design_schema: type.design_schema || { fields: {} },
        ownership: type.ownership || 'system',
        app_id: type.app_id || '',
        is_active: type.is_active ?? true
      })
      setSchemaText(JSON.stringify(type.design_schema || { fields: {} }, null, 2))
    }
  }, [type])

  // Handle save
  const handleSave = async () => {
    try {
      // Validate database constraints
      const { ownership, app_id } = editData
      
      // Constraint: (app_id is not null) or (ownership = 'system')
      if (ownership !== 'system' && !app_id) {
        throw new Error('App selection is required when ownership is not "System"')
      }
      
      // Handle schema safely - try to parse, but don't fail if invalid for now
      let parsedSchema = { fields: {} }
      try {
        parsedSchema = JSON.parse(schemaText)
      } catch (error) {
        // For now, accept invalid JSON and save default schema
        console.warn('Invalid JSON in schema field, using default:', error)
      }
      
      const saveData = {
        ...editData,
        design_schema: parsedSchema,
        app_id: editData.app_id || null
      }
      
      const url = isCreateMode 
        ? '/api/types?action=create'
        : `/api/types?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
      })
      
      if (!response.ok) throw new Error(`Failed to ${isCreateMode ? 'create' : 'update'} type`)
      
      if (isCreateMode) {
        // Navigate to the new type
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/${kind || 'types'}/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error(`Error ${isCreateMode ? 'creating' : 'updating'} type:`, error)
      // Show error to user
      alert(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/types')
      return
    }
    
    // Reset edit data to original values
    if (type) {
      setEditData({
        name: type.name,
        slug: type.slug,
        description: type.description || '',
        icon: type.icon || '',
        color: type.color || '',
        design_schema: type.design_schema || { fields: {} },
        ownership: type.ownership || 'system',
        app_id: type.app_id || '',
        is_active: type.is_active ?? true
      })
      setSchemaText(JSON.stringify(type.design_schema || { fields: {} }, null, 2))
    }
    setIsEditing(false)
  }

  // Handle edit button click
  const handleEdit = () => {
    setIsEditing(true)
  }

  // Fetch items of this type (only in edit mode)
  const { data: items, loading: itemsLoading } = useApi<TypeItem[]>(
    async () => {
      if (isCreateMode) {
        return [] // No items for create mode
      }
      const response = await apiFetch(`/api/admin-data?entity=items&type_id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch items')
      const result = await response.json()
      return result.data || []
    },
    { immediate: !isCreateMode }
  )

  // Delete mutation
  const deleteMutation = useMutation(
    async () => {
      const response = await apiFetch(`/api/types?action=delete&id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete type')
      return response.json()
    },
    {
      onSuccess: () => {
        navigate(`/admin/configs/${kind || 'types'}`)
      }
    }
  )

  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || (!type && !isCreateMode)) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load type details</p>
        <Button onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  
  // Table columns for items
  const itemColumns = [
    {
      key: 'id' as keyof TypeItem,
      title: 'ID',
      render: (value: any, _item: TypeItem) => (
        <span className="font-mono text-xs">{value?.slice(0, 8)}...</span>
      )
    },
    {
      key: 'data' as keyof TypeItem,
      title: 'Data',
      render: (value: any, _item: TypeItem) => {
        const firstFieldKey = Object.keys(type?.design_schema?.fields || {})[0]
        const displayValue = firstFieldKey ? value[firstFieldKey] : 'No data'
        return (
          <div>
            <div className="font-medium">{displayValue}</div>
            <div className="text-xs text-slate-500">
              {Object.keys(value || {}).length} fields
            </div>
          </div>
        )
      }
    },
    {
      key: 'created_at' as keyof TypeItem,
      title: 'Created',
      render: (value: any, _item: TypeItem) => formatDateTime(value)
    },
    {
      key: 'updated_at' as keyof TypeItem,
      title: 'Updated',
      render: (value: any, _item: TypeItem) => formatDateTime(value)
    }
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => isCreateMode ? navigate('/admin/configs/types') : navigate(-1)}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isCreateMode ? 'Create Type' : type?.name}
            </h1>
            <p className="text-sm text-slate-600">
              {isCreateMode ? 'Type Configuration' : 'Type Details'}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
              >
                {isCreateMode ? 'Create' : 'Save Changes'}
              </Button>
            </>
          ) : (
            !isCreateMode && (
              <>
                <Button
                  variant="outline"
                  onClick={handleEdit}
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteModalOpen(true)}
                  disabled={type?.ownership === 'system'}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )
          )}
        </div>
      </div>

      {isEditing ? (
        <>
          {/* Type Info - Edit Mode */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-medium text-slate-900">
                {isCreateMode ? `Create New ${typeKind.charAt(0).toUpperCase() + typeKind.slice(1)}` : `Edit ${type?.name || 'Type'}`}
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side - Editable Fields */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-4">Type Details</h3>
                  <dl className="space-y-4">
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Name:</dt>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Slug:</dt>
                      <input
                        type="text"
                        value={editData.slug}
                        onChange={(e) => setEditData({...editData, slug: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Description:</dt>
                      <input
                        type="text"
                        value={editData.description}
                        onChange={(e) => setEditData({...editData, description: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter description"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Kind:</dt>
                      <select
                        value={editData.kind}
                        onChange={(e) => setEditData({...editData, kind: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {typeKind ? (
                          <option value={typeKind}>{typeKind.charAt(0).toUpperCase() + typeKind.slice(1)}</option>
                        ) : (
                          <>
                            <option value="item">Item</option>
                            <option value="account">Account</option>
                            <option value="person">Person</option>
                            <option value="thread">Thread</option>
                            <option value="message">Message</option>
                          </>
                        )}
                      </select>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Ownership:</dt>
                      <select
                        value={editData.ownership}
                        onChange={(e) => setEditData({...editData, ownership: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="system">System</option>
                        <option value="app">App</option>
                        <option value="tenant">Tenant</option>
                      </select>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Is Active:</dt>
                      <input
                        type="checkbox"
                        checked={editData.is_active}
                        onChange={(e) => setEditData({...editData, is_active: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border border-slate-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  </dl>
                </div>
                
                {/* Right Side - Metadata */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-4">Metadata</h3>
                  <dl className="space-y-4">
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">ID:</dt>
                      <dd className="text-sm text-slate-900 font-mono">{type?.id || 'Auto-generated'}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">App ID:</dt>
                      <select
                        value={editData.app_id || ''}
                        onChange={(e) => setEditData({...editData, app_id: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">None (System Types)</option>
                        {availableApps.map(app => (
                          <option key={app.id} value={app.id}>{app.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Icon:</dt>
                      <input
                        type="text"
                        value={editData.icon || ''}
                        onChange={(e) => setEditData({...editData, icon: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter icon name"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Color:</dt>
                      <select
                        value={editData.color || ''}
                        onChange={(e) => setEditData({...editData, color: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select color</option>
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="red">Red</option>
                        <option value="yellow">Yellow</option>
                        <option value="purple">Purple</option>
                        <option value="pink">Pink</option>
                        <option value="indigo">Indigo</option>
                        <option value="gray">Gray</option>
                        <option value="slate">Slate</option>
                      </select>
                    </div>
                    
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Created:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(type?.created_at) || 'Not yet created'}</dd>
                    </div>
                    
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Updated:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(type?.updated_at) || 'Not yet updated'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              {/* Schema Field - Full Width */}
              <div className="mt-8">
                <h3 className="text-sm font-medium text-slate-500 mb-4">Schema Definition</h3>
                <div>
                  <label className="block text-sm text-slate-600 mb-2">Schema:</label>
                  <textarea
                    value={schemaText}
                    onChange={(e) => setSchemaText(e.target.value)}
                    className="w-full text-sm text-slate-900 border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    rows={8}
                    placeholder='Enter JSON schema with fields object'
                  />
                  <p className="text-xs text-slate-500 mt-1">JSON schema defining the fields for this type. Use the format with fields object containing field definitions.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Type Info - View Only */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-medium text-slate-900">Type Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side - Type Details */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-4">Type Details</h3>
                  <dl className="space-y-4">
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Name:</dt>
                      <dd className="text-sm text-slate-900">{type?.name}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Slug:</dt>
                      <dd className="text-sm text-slate-900 font-mono">{type?.slug}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Description:</dt>
                      <dd className="text-sm text-slate-900">{type?.description || 'No description'}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Kind:</dt>
                      <dd className="text-sm text-slate-900">
                        <Badge variant="default">{type?.kind}</Badge>
                      </dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Ownership:</dt>
                      <dd className="text-sm text-slate-900">
                        <Badge variant="default">{type?.ownership}</Badge>
                      </dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Status:</dt>
                      <dd className="text-sm text-slate-900">
                        <Badge variant={type?.is_active ? 'success' : 'default'}>
                          {type?.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>
                
                {/* Right Side - Metadata */}
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-4">Metadata</h3>
                  <dl className="space-y-4">
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">ID:</dt>
                      <dd className="text-sm text-slate-900 font-mono">{type?.id}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">App ID:</dt>
                      <dd className="text-sm text-slate-900 font-mono">{type?.app_id || 'None'}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Icon:</dt>
                      <dd className="text-sm text-slate-900">{type?.icon || 'None'}</dd>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <dt className="text-sm text-slate-600">Color:</dt>
                      <dd className="text-sm text-slate-900">
                        <span className={`inline-block w-3 h-3 rounded-full mr-2`} style={{backgroundColor: type?.color}}></span>
                        {type?.color || 'None'}
                      </dd>
                    </div>
                    
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Created:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(type?.created_at)}</dd>
                    </div>
                    
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Updated:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(type?.updated_at)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              
              {/* Schema Field - Full Width */}
              <div className="mt-8">
                <h3 className="text-sm font-medium text-slate-500 mb-4">Schema Definition</h3>
                <div>
                  <label className="block text-sm text-slate-600 mb-2">Schema:</label>
                  <pre className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 overflow-auto max-h-48">
                    {JSON.stringify(type?.design_schema || { fields: {} }, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">{Object.keys(type?.design_schema?.fields || {}).length}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-slate-900">Fields</h3>
                  <p className="text-sm text-slate-500">Schema field definitions</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-semibold">{items?.length || 0}</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-slate-900">Items</h3>
                  <p className="text-sm text-slate-500">Items using this type</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-medium text-slate-900">Items ({items?.length || 0})</h2>
            </div>
            <div className="overflow-hidden">
              {itemsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : items && items.length > 0 ? (
                <DataTable
                  data={items}
                  columns={itemColumns as any}
                  searchable={false}
                />
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No items found for this type
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Type"
        description="Are you sure you want to delete this type? This action cannot be undone."
        size="sm"
      >
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.loading}
          >
            {deleteMutation.loading ? 'Deleting...' : 'Delete Type'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
