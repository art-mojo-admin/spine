import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { 
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { formatDateTime } from '../../lib/utils'

interface Integration {
  id: string
  name: string
  provider: string
  integration_type: 'webhook' | 'api' | 'database' | 'file' | 'custom'
  description?: string
  config: Record<string, any>
  is_active: boolean
  is_system?: boolean
  created_at: string
  updated_at: string
  account_id: string
  last_sync?: string
  sync_status?: 'success' | 'failed' | 'pending'
  error_message?: string
}

export function IntegrationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'

  const [integration, setIntegration] = useState<Integration | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(isCreateMode)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    provider: '',
    integration_type: 'api' as const,
    description: '',
    config: '{}',
    is_active: true
  })

  useEffect(() => {
    if (isCreateMode) {
      setLoading(false)
      return
    }

    // Fetch integration details
    setLoading(true)
    const fetchIntegration = async () => {
      try {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(id)) {
          throw new Error('Invalid ID format')
        }
        
        const response = await apiFetch(`/api/integrations?action=get&id=${id}`)
        if (!response.ok) {
          if (response.status === 500) {
            throw new Error('Integration not found')
          }
          throw new Error('Failed to fetch integration')
        }
        const result = await response.json()
        const integrationData = result.data
        
        setIntegration(integrationData)
        setFormData({
          name: integrationData.name,
          provider: integrationData.provider,
          integration_type: integrationData.integration_type,
          description: integrationData.description || '',
          config: JSON.stringify(integrationData.config, null, 2),
          is_active: integrationData.is_active
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load integration')
      } finally {
        setLoading(false)
      }
    }

    fetchIntegration()
  }, [id, isCreateMode])

  const handleSave = async () => {
    try {
      const configData = JSON.parse(formData.config)
      const payload = {
        name: formData.name,
        provider: formData.provider,
        integration_type: formData.integration_type,
        description: formData.description,
        config: configData,
        is_active: formData.is_active
      }

      const response = await apiFetch(`/api/integrations?action=${isCreateMode ? 'create' : 'update'}${isCreateMode ? '' : `?id=${id}`}`, {
        method: isCreateMode ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error('Failed to save integration')
      
      if (isCreateMode) {
        const result = await response.json()
        const newId = result.data?.id || result.data?.integration_id || result.id || result.integration_id
        navigate(`/admin/configs/integrations/${newId}`)
      } else {
        setIsEditing(false)
        // Refetch data
        window.location.reload()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save integration')
    }
  }

  const handleDelete = async () => {
    if (!integration || integration.is_system) return
    
    if (!confirm('Are you sure you want to delete this integration?')) return

    try {
      const response = await apiFetch(`/api/integrations?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete integration')
      
      navigate('/admin/configs/integrations')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete integration')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'webhook':
        return '🔗'
      case 'api':
        return '🔌'
      case 'database':
        return '🗄️'
      case 'file':
        return '📁'
      case 'custom':
        return '⚙️'
      default:
        return '📦'
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'pending':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <Button onClick={() => navigate('/admin/configs/integrations')} className="mt-4">
          Back to Integrations
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/configs/integrations')}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isCreateMode ? 'Create Integration' : integration?.name}
            </h1>
            <p className="text-sm text-slate-600">
              {isCreateMode ? 'Configure a new integration' : 'Integration Configuration'}
            </p>
          </div>
        </div>
        
        {!isCreateMode && (
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={integration?.is_system}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
        
        {isCreateMode && (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => navigate('/admin/configs/integrations')}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Create Integration
            </Button>
          </div>
        )}
      </div>

      {/* Overview Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Overview</h2>
        </div>
        <div className="px-6 py-4">
          {isEditing || isCreateMode ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  className="block w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Integration name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                <input
                  type="text"
                  className="block w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  placeholder="e.g. slack, github, salesforce"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  className="block w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.integration_type}
                  onChange={(e) => setFormData({ ...formData, integration_type: e.target.value as any })}
                >
                  <option value="webhook">Webhook</option>
                  <option value="api">API</option>
                  <option value="database">Database</option>
                  <option value="file">File</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  className="block w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this integration"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Configuration (JSON)</label>
                <textarea
                  className="block w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                  rows={8}
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  placeholder='{"api_key": "...", "webhook_url": "..."}'
                />
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-slate-700">Active</span>
                </label>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-sm text-slate-900">{integration?.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Provider</dt>
                <dd className="mt-1 text-sm text-slate-900">{integration?.provider}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Type</dt>
                <dd className="mt-1 flex items-center">
                  <span className="mr-2">{getTypeIcon(integration?.integration_type || '')}</span>
                  <span className="text-sm text-slate-900 capitalize">{integration?.integration_type}</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Status</dt>
                <dd className="mt-1 flex items-center">
                  {integration?.is_active ? (
                    <span className="inline-flex items-center text-sm text-green-600">
                      <CheckCircleIcon className="h-4 w-4 mr-1" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-sm text-red-600">
                      <XCircleIcon className="h-4 w-4 mr-1" /> Inactive
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">System Integration</dt>
                <dd className="mt-1">
                  {integration?.is_system ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      System
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      Custom
                    </span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-slate-500">Description</dt>
                <dd className="mt-1 text-sm text-slate-900">{integration?.description || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Created</dt>
                <dd className="mt-1 text-sm text-slate-900">{integration ? formatDateTime(integration.created_at) : ''}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Updated</dt>
                <dd className="mt-1 text-sm text-slate-900">{integration ? formatDateTime(integration.updated_at) : ''}</dd>
              </div>
              {integration?.last_sync && (
                <div>
                  <dt className="text-sm font-medium text-slate-500">Last Sync</dt>
                  <dd className="mt-1 flex items-center">
                    {formatDateTime(integration.last_sync)}
                    {getStatusIcon(integration.sync_status)}
                  </dd>
                </div>
              )}
              {integration?.error_message && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">Last Error</dt>
                  <dd className="mt-1 text-sm text-red-600">{integration.error_message}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Configuration Preview */}
      {!isCreateMode && !isEditing && integration && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-medium text-slate-900">Configuration</h2>
          </div>
          <div className="px-6 py-4">
            <pre className="bg-slate-50 p-4 rounded-md text-sm overflow-x-auto">
              {JSON.stringify(integration.config, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
