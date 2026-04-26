import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { useMutation } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { 
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { formatDateTime } from '../../lib/utils'

interface App {
  id: string
  slug: string
  name: string
  description?: string
  app_type: string
  version: string
  icon?: string
  color?: string
  source: string
  owner_account_id: string
  is_active: boolean
  is_system: boolean
  min_role: string
  created_at: string
  updated_at?: string
  config?: Record<string, any>
  is_public?: boolean
  item_count?: number
  user_count?: number
  account_name?: string
  created_by?: string
  account_id?: string
}

export function AppDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>({
    name: '',
    slug: '',
    description: '',
    app_type: 'custom',
    version: '1.0.0',
    icon: null,
    color: null,
    source: 'custom',
    owner_account_id: '',
    is_active: true,
    is_system: false,
    min_role: 'member',
    config: {},
    is_public: false
  })
  const [configText, setConfigText] = useState(JSON.stringify({}, null, 2))

  // Fetch app details
  const { data: app, loading, error, refetch } = useApi<App>(
    async () => {
      if (isCreateMode) {
        // Return empty app for create mode
        return {
          id: '',
          slug: '',
          name: '',
          description: '',
          app_type: 'custom',
          version: '1.0.0',
          icon: null,
          color: null,
          source: 'custom',
          owner_account_id: '',
          is_active: true,
          is_system: false,
          min_role: 'member',
          created_at: new Date().toISOString(),
          config: {},
          is_public: false
        }
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id!)) {
        throw new Error('Invalid ID format')
      }
      
      const response = await apiFetch(`/api/apps?action=get&id=${id}`)
      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          throw new Error('App not found')
        }
        throw new Error('Failed to fetch app')
      }
      const result = await response.json()
      return result.data || result
    },
    { immediate: true }
  )

  // Initialize edit data when app loads
  useEffect(() => {
    if (app) {
      const initialData = {
        name: app.name,
        slug: app.slug,
        description: app.description || '',
        app_type: app.app_type,
        version: app.version,
        icon: app.icon || null,
        color: app.color || null,
        source: app.source,
        owner_account_id: app.owner_account_id,
        is_active: app.is_active,
        is_system: app.is_system,
        min_role: app.min_role,
        config: app.config || {},
        is_public: app.is_public || false
      }
      setEditData(initialData)
      setConfigText(JSON.stringify(app.config || {}, null, 2))
    }
  }, [app])

  // Handle save
  const handleSave = async () => {
    try {
      // Parse config safely - accept invalid JSON for now
      let parsedConfig = {}
      try {
        parsedConfig = JSON.parse(configText)
      } catch (error) {
        console.warn('Invalid JSON in config field, using default:', error)
      }
      
      const saveData = {
        ...editData,
        config: parsedConfig
      }
      
      const url = isCreateMode 
        ? '/api/apps?action=create'
        : `/api/apps?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData)
      })
      
      if (!response.ok) throw new Error('Failed to save app')
      
      if (isCreateMode) {
        // Navigate to the new app
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/apps/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving app:', error)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/apps')
      return
    }
    
    // Reset edit data to original values
    if (app) {
      const resetData = {
        name: app.name,
        slug: app.slug,
        description: app.description || '',
        app_type: app.app_type,
        version: app.version,
        icon: app.icon || null,
        color: app.color || null,
        source: app.source,
        owner_account_id: app.owner_account_id,
        is_active: app.is_active,
        is_system: app.is_system,
        min_role: app.min_role,
        config: app.config || {},
        is_public: app.is_public || false
      }
      setEditData(resetData)
      setConfigText(JSON.stringify(app.config || {}, null, 2))
    }
    setIsEditing(false)
  }

  // Handle edit button click
  const handleEdit = () => {
    setIsEditing(true)
  }

  // Delete mutation
  const deleteMutation = useMutation(
    async () => {
      const response = await apiFetch(`/api/apps?action=delete&id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete app')
      return response.json()
    },
    {
      onSuccess: () => {
        navigate('/admin/configs/apps')
      }
    }
  )

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-semibold">Failed to load app</div>
        <div className="mt-1">Error: {String(error)}</div>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">App not found</h3>
        <p className="mt-2 text-sm text-slate-500">The app you're looking for doesn't exist.</p>
        <Button
          onClick={() => navigate('/admin/configs/apps')}
          className="mt-4"
        >
          Back to Apps
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => isCreateMode ? navigate('/admin/configs/apps') : navigate(-1)}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isCreateMode ? 'Create App' : app?.name}
            </h1>
            <p className="text-sm text-slate-600">
              {isCreateMode ? 'App Configuration' : 'App Details'}
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
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )
          )}
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">App Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-500">Basic Info</h3>
              <dl className="mt-2 space-y-4">
                {!isCreateMode && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">ID:</dt>
                    <dd className="text-sm text-slate-900 font-mono">{app.id}</dd>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Name:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{app.name}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Slug:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.slug}
                      onChange={(e) => setEditData({...editData, slug: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900 font-mono">{app.slug}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Description:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.description}
                      onChange={(e) => setEditData({...editData, description: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter description"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{app.description || 'No description'}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Type:</dt>
                  {isEditing ? (
                    <select
                      value={editData.app_type}
                      onChange={(e) => setEditData({...editData, app_type: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="system">System</option>
                      <option value="custom">Custom</option>
                      <option value="marketplace">Marketplace</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <Badge variant="primary">{app.app_type}</Badge>
                    </dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Source:</dt>
                  {isEditing ? (
                    <select
                      value={editData.source}
                      onChange={(e) => setEditData({...editData, source: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="system">System</option>
                      <option value="custom">Custom</option>
                      <option value="marketplace">Marketplace</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <Badge variant="secondary">{app.source}</Badge>
                    </dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Min Role:</dt>
                  {isEditing ? (
                    <select
                      value={editData.min_role}
                      onChange={(e) => setEditData({...editData, min_role: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <Badge variant="info">{app.min_role}</Badge>
                    </dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Version:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.version}
                      onChange={(e) => setEditData({...editData, version: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{app.version}</dd>
                  )}
                </div>
              </dl>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-slate-500">Status & Access</h3>
              <dl className="mt-2 space-y-4">
                <div className="flex justify-between">
                  <dt className="text-sm text-slate-600">Active:</dt>
                  {isEditing ? (
                    <select
                      value={editData.is_active}
                      onChange={(e) => setEditData({...editData, is_active: e.target.value === 'true'})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <Badge variant={app.is_active ? 'success' : 'default'}>
                        {app.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </dd>
                  )}
                </div>
                
                <div className="flex justify-between">
                  <dt className="text-sm text-slate-600">System:</dt>
                  {isEditing ? (
                    <select
                      value={editData.is_system}
                      onChange={(e) => setEditData({...editData, is_system: e.target.value === 'true'})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">System</option>
                      <option value="false">Custom</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <Badge variant={app.is_system ? 'secondary' : 'primary'}>
                        {app.is_system ? 'System' : 'Custom'}
                      </Badge>
                    </dd>
                  )}
                </div>
                
                {!isCreateMode && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Owner Account ID:</dt>
                      <dd className="text-sm text-slate-900 font-mono">{app.owner_account_id || '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Created:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(app.created_at)}</dd>
                    </div>
                    {app.updated_at && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-slate-600">Updated:</dt>
                        <dd className="text-sm text-slate-900">{formatDateTime(app.updated_at)}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration JSON */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Configuration JSON</h2>
        </div>
        <div className="p-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                App Configuration (JSON)
              </label>
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="w-full h-64 font-mono text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter JSON configuration..."
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter JSON for app configuration. Invalid JSON will be handled on save.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap">
                  {JSON.stringify(app.config, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Configuration contains {Object.keys(app.config || {}).length} properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete App"
        description="Are you sure you want to delete this app? This action cannot be undone."
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
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.loading}
          >
            {deleteMutation.loading ? 'Deleting...' : 'Delete App'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
