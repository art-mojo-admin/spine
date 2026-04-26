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

export function AccountTypeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>(() => 
    isCreateMode ? {
      name: '',
      slug: '',
      description: '',
      icon: '',
      color: '',
      schema: { fields: {} },
      is_active: true
    } : {}
  )

  // Fetch account type details
  const { data: accountType, loading, error, refetch } = useApi<AccountType>(
    async () => {
      if (isCreateMode) {
        // Return empty account type for create mode
        return {
          id: '',
          name: '',
          slug: '',
          kind: 'account',
          description: '',
          icon: '',
          color: '',
          schema: { fields: {} },
          ownership: 'app',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      } else {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(id!)) {
          throw new Error('Invalid ID format')
        }
        
        const response = await apiFetch(`/api/types?action=get&id=${id}`)
        if (!response.ok) {
          if (response.status === 500) {
            throw new Error('Account type not found')
          }
          throw new Error('Failed to fetch account type')
        }
        const result = await response.json()
        return result.data || result // Handle both nested and direct responses
      }
    },
    { immediate: true }
  )

  // Initialize edit data when account type loads
  useEffect(() => {
    if (accountType) {
      setEditData({
        name: accountType.name,
        slug: accountType.slug,
        description: accountType.description || '',
        icon: accountType.icon || '',
        color: accountType.color || '',
        schema: accountType.schema || { fields: {} },
        ownership: accountType.ownership,
        is_active: accountType.is_active
      })
    }
  }, [accountType])

  // Handle save
  const handleSave = async () => {
    try {
      const url = isCreateMode 
        ? '/api/types?action=create'
        : `/api/types?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editData,
          kind: 'account', // Ensure kind is always 'account'
          ownership: editData.ownership || 'custom'
        })
      })
      
      if (!response.ok) throw new Error('Failed to save account type')
      
      if (isCreateMode) {
        // Navigate to the new account type
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/accounts/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving account type:', error)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/accounts')
      return
    }
    
    // Reset edit data to original values
    if (accountType) {
      setEditData({
        name: accountType.name,
        slug: accountType.slug,
        description: accountType.description || '',
        icon: accountType.icon || '',
        color: accountType.color || '',
        schema: accountType.schema || { fields: {} },
        is_active: accountType.is_active
      })
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
      const response = await apiFetch(`/api/types?action=delete&id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete account type')
      return response.json()
    },
    {
      onSuccess: () => {
        navigate('/admin/configs/accounts')
      }
    }
  )

  // Helper function for type badge colors
  function getTypeBadgeColor(isSystem: boolean) {
    return isSystem ? 'secondary' : 'primary'
  }

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
        <div className="font-semibold">Failed to load account type</div>
        <div className="mt-1">Error: {String(error)}</div>
      </div>
    )
  }

  if (!accountType && !isCreateMode) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Account type not found</h3>
        <p className="mt-2 text-sm text-slate-500">The account type you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/admin/configs/accounts')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    )
  }

  // After the guard above, accountType is non-null in non-create mode
  const at = accountType!

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => isCreateMode ? navigate('/admin/configs/accounts') : navigate(-1)}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isCreateMode ? 'Create Account Type' : at.name}
            </h1>
            <p className="text-sm text-slate-600">
              {isCreateMode ? 'Account Type Configuration' : 'Account Type Details'}
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
            <>
              <Button
                variant="outline"
                onClick={handleEdit}
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                disabled={at.ownership === 'system'}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Type Info */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Account Type Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-500">Basic Info</h3>
              <dl className="mt-2 space-y-4">
                {!isCreateMode && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">ID:</dt>
                    <dd className="text-sm text-slate-900 font-mono">{at.id}</dd>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Name:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={(e) => setEditData({...editData, name: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{isCreateMode ? editData.name : at.name}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Slug:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.slug || ''}
                      onChange={(e) => setEditData({...editData, slug: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900 font-mono">{isCreateMode ? editData.slug : at.slug}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Description:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.description || ''}
                      onChange={(e) => setEditData({...editData, description: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter description"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{isCreateMode ? (editData.description || 'No description') : (at.description || 'No description')}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Icon:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.icon || ''}
                      onChange={(e) => setEditData({...editData, icon: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter icon name"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{isCreateMode ? (editData.icon || 'No icon') : (at.icon || 'No icon')}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Color:</dt>
                  {isEditing ? (
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
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <span className={`inline-block w-3 h-3 rounded-full mr-2`} style={{backgroundColor: isCreateMode ? editData.color : at.color}}></span>
                      {isCreateMode ? (editData.color || 'No color') : (at.color || 'No color')}
                    </dd>
                  )}
                </div>
                
                {!isCreateMode && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">Category:</dt>
                    <dd className="text-sm text-slate-900">
                      <Badge variant={getTypeBadgeColor(at.ownership === 'system')}>
                        {at.ownership === 'system' ? 'System' : 'Custom'}
                      </Badge>
                    </dd>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <dt className="text-sm text-slate-600">Status:</dt>
                  {isEditing ? (
                    <select
                      value={editData.is_active ? 'true' : 'false'}
                      onChange={(e) => setEditData({...editData, is_active: e.target.value === 'true'})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <Badge variant={(isCreateMode ? editData.is_active : at.is_active) ? 'success' : 'default'}>
                        {(isCreateMode ? editData.is_active : at.is_active) ? 'Active' : 'Inactive'}
                      </Badge>
                    </dd>
                  )}
                </div>
              </dl>
            </div>
            
            {!isCreateMode && (
              <div>
                <h3 className="text-sm font-medium text-slate-500">Statistics</h3>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">Fields:</dt>
                    <dd className="text-sm text-slate-900">{Object.keys(at.schema?.fields || {}).length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">Created:</dt>
                    <dd className="text-sm text-slate-900">{formatDateTime(at.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">Updated:</dt>
                    <dd className="text-sm text-slate-900">{formatDateTime(at.updated_at)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schema JSON */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Schema JSON</h2>
        </div>
        <div className="p-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Schema Definition (JSON)
              </label>
              <textarea
                value={JSON.stringify(editData.schema, null, 2)}
                onChange={(e) => {
                  try {
                    const schema = JSON.parse(e.target.value)
                    setEditData({...editData, schema})
                  } catch (error) {
                    // Invalid JSON, don't update state
                  }
                }}
                className="w-full h-64 font-mono text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter valid JSON schema..."
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter valid JSON. The schema should contain a "fields" object with field definitions.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap">
                  {JSON.stringify(at.schema, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Schema contains {Object.keys(at.schema?.fields || {}).length} field definitions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Account Type"
        description="Are you sure you want to delete this account type? This action cannot be undone."
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
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.loading}
          >
            {deleteMutation.loading ? 'Deleting...' : 'Delete Account Type'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
