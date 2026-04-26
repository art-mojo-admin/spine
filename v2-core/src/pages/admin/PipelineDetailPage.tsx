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
  PlayIcon,
  ClockIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { formatDateTime } from '../../lib/utils'

interface Pipeline {
  id: string
  name: string
  description?: string
  trigger_type: string
  trigger_config: Record<string, any>
  stages: Array<{
    name: string
    type: string
    config: Record<string, any>
    order: number
  }>
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  account_id: string
  app_id?: string
  config?: Record<string, any>
  metadata?: Record<string, any>
}

export function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>({
    name: '',
    description: '',
    trigger_type: 'manual',
    trigger_config: {},
    stages: [],
    config: {},
    metadata: {},
    is_active: true
  })

  // Fetch pipeline details
  const { data: pipeline, loading, error, refetch } = useApi<Pipeline>(
    async () => {
      if (isCreateMode) {
        // Return empty pipeline for create mode
        return {
          id: '',
          name: '',
          description: '',
          trigger_type: 'manual',
          trigger_config: {},
          stages: [],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: '',
          account_id: '',
          config: {},
          metadata: {}
        }
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id!)) {
        throw new Error('Invalid ID format')
      }
      
      const response = await apiFetch(`/api/pipelines?action=get&id=${id}`)
      if (!response.ok) {
        if (response.status === 500) {
          throw new Error('Pipeline not found')
        }
        throw new Error('Failed to fetch pipeline')
      }
      const result = await response.json()
      
      // The API might return nested or direct response
      const pipeline = result.data || result
      
      if (!pipeline) {
        throw new Error('Pipeline not found')
      }
      
      return pipeline
    },
    { immediate: true }
  )

  // Initialize edit data when pipeline loads
  useEffect(() => {
    if (pipeline) {
      setEditData({
        name: pipeline.name,
        description: pipeline.description || '',
        trigger_type: pipeline.trigger_type,
        trigger_config: pipeline.trigger_config || {},
        stages: pipeline.stages || [],
        is_active: pipeline.is_active,
        config: pipeline.config || {},
        metadata: pipeline.metadata || {}
      })
    }
  }, [pipeline])

  // Handle save
  const handleSave = async () => {
    try {
      const url = isCreateMode 
        ? '/api/pipelines?action=create'
        : `/api/pipelines?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      })
      
      if (!response.ok) throw new Error('Failed to save pipeline')
      
      if (isCreateMode) {
        // Navigate to the new pipeline
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/pipelines/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving pipeline:', error)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/pipelines')
      return
    }
    
    // Reset edit data to original values
    if (pipeline) {
      setEditData({
        name: pipeline.name,
        description: pipeline.description || '',
        trigger_type: pipeline.trigger_type,
        trigger_config: pipeline.trigger_config || {},
        stages: pipeline.stages || [],
        is_active: pipeline.is_active,
        config: pipeline.config || {},
        metadata: pipeline.metadata || {}
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
      const response = await apiFetch(`/api/pipelines?action=delete&id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete pipeline')
      return response.json()
    },
    {
      onSuccess: () => {
        navigate('/admin/configs/pipelines')
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
        <div className="font-semibold">Failed to load pipeline</div>
        <div className="mt-1">Error: {String(error)}</div>
      </div>
    )
  }

  if (!pipeline) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Pipeline not found</h3>
        <p className="mt-2 text-sm text-slate-500">The pipeline you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/admin/configs/pipelines')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    )
  }

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'schedule':
        return <CalendarIcon className="h-5 w-5 text-blue-500" />
      case 'webhook':
        return <PlayIcon className="h-5 w-5 text-green-500" />
      case 'event':
        return <ClockIcon className="h-5 w-5 text-purple-500" />
      default:
        return <PlayIcon className="h-5 w-5 text-slate-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/configs/pipelines')}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{pipeline.name || 'New Pipeline'}</h1>
            <p className="text-sm text-slate-600">Pipeline Details</p>
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
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Pipeline Info */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Pipeline Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-500">Basic Info</h3>
              <dl className="mt-2 space-y-4">
                {!isCreateMode && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">ID:</dt>
                    <dd className="text-sm text-slate-900 font-mono">{pipeline.id}</dd>
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
                    <dd className="text-sm text-slate-900">{pipeline.name}</dd>
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
                    <dd className="text-sm text-slate-900">{pipeline.description || 'No description'}</dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Trigger Type:</dt>
                  {isEditing ? (
                    <select
                      value={editData.trigger_type}
                      onChange={(e) => setEditData({...editData, trigger_type: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="manual">Manual</option>
                      <option value="webhook">Webhook</option>
                      <option value="event">Event</option>
                      <option value="schedule">Schedule</option>
                    </select>
                  ) : (
                    <dd className="text-sm text-slate-900">
                      <div className="flex items-center space-x-2">
                        {getTriggerIcon(pipeline.trigger_type)}
                        <Badge variant="primary">{pipeline.trigger_type}</Badge>
                      </div>
                    </dd>
                  )}
                </div>
              </dl>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-slate-500">Status & Settings</h3>
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
                      <Badge variant={pipeline.is_active ? 'success' : 'default'}>
                        {pipeline.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </dd>
                  )}
                </div>
                
                {!isCreateMode && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Stages:</dt>
                      <dd className="text-sm text-slate-900">{pipeline.stages?.length || 0} stages</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Created:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(pipeline.created_at)}</dd>
                    </div>
                    {pipeline.updated_at && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-slate-600">Updated:</dt>
                        <dd className="text-sm text-slate-900">{formatDateTime(pipeline.updated_at)}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Trigger Configuration */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Trigger Configuration</h2>
        </div>
        <div className="p-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Trigger Configuration (JSON)
              </label>
              <textarea
                value={JSON.stringify(editData.trigger_config, null, 2)}
                onChange={(e) => {
                  try {
                    const trigger_config = JSON.parse(e.target.value)
                    setEditData({...editData, trigger_config})
                  } catch (error) {
                    // Invalid JSON, don't update state
                  }
                }}
                className="w-full h-32 font-mono text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter valid JSON for trigger configuration..."
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter valid JSON for trigger configuration.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap">
                  {JSON.stringify(pipeline.trigger_config || {}, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Trigger configuration contains {Object.keys(pipeline.trigger_config || {}).length} properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Pipeline Stages</h2>
        </div>
        <div className="p-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pipeline Stages (JSON)
              </label>
              <textarea
                value={JSON.stringify(editData.stages, null, 2)}
                onChange={(e) => {
                  try {
                    const stages = JSON.parse(e.target.value)
                    setEditData({...editData, stages})
                  } catch (error) {
                    // Invalid JSON, don't update state
                  }
                }}
                className="w-full h-48 font-mono text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter valid JSON for pipeline stages..."
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter valid JSON array for pipeline stages.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap">
                  {JSON.stringify(pipeline.stages || [], null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Pipeline contains {(pipeline.stages || []).length} stages
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Configuration */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Additional Configuration</h2>
        </div>
        <div className="p-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pipeline Configuration (JSON)
              </label>
              <textarea
                value={JSON.stringify(editData.config, null, 2)}
                onChange={(e) => {
                  try {
                    const config = JSON.parse(e.target.value)
                    setEditData({...editData, config})
                  } catch (error) {
                    // Invalid JSON, don't update state
                  }
                }}
                className="w-full h-32 font-mono text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter valid JSON for additional configuration..."
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter valid JSON for additional pipeline configuration.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap">
                  {JSON.stringify(pipeline.config || {}, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Configuration contains {Object.keys(pipeline.config || {}).length} properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Pipeline"
        description="Are you sure you want to delete this pipeline? This action cannot be undone."
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
            {deleteMutation.loading ? 'Deleting...' : 'Delete Pipeline'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
