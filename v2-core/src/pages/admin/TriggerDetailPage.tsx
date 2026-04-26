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
  LinkIcon,
  BoltIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { formatDateTime } from '../../lib/utils'

interface Trigger {
  id: string
  name: string
  description?: string
  trigger_type: 'schedule' | 'webhook' | 'event' | 'manual'
  event_type?: string
  config: Record<string, any>
  pipeline_id?: string
  pipeline_name?: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  account_id: string
  app_id?: string
  last_triggered?: string
  trigger_count: number
  metadata?: Record<string, any>
}

export function TriggerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>({})

  // Fetch trigger details
  const { data: trigger, loading, error, refetch } = useApi<Trigger>(
    async () => {
      if (isCreateMode) {
        // Return empty trigger for create mode
        return {
          id: '',
          name: '',
          description: '',
          trigger_type: 'manual',
          event_type: '',
          config: {},
          pipeline_id: '',
          pipeline_name: '',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: '',
          account_id: '',
          app_id: '',
          last_triggered: '',
          trigger_count: 0,
          metadata: {}
        }
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id!)) {
        throw new Error('Invalid ID format')
      }
      
      const response = await apiFetch(`/api/triggers?method=GET&id=${id}`)
      if (!response.ok) {
        if (response.status === 500) {
          throw new Error('Trigger not found')
        }
        throw new Error('Failed to fetch trigger')
      }
      const result = await response.json()
      console.log('TriggerDetailPage API result:', result)
      
      // The API might return nested or direct response
      const trigger = result.data || result
      
      if (!trigger) {
        throw new Error('Trigger not found')
      }
      
      console.log('Found trigger:', trigger)
      return trigger
    },
    { immediate: true }
  )

  // Initialize edit data when trigger loads
  useEffect(() => {
    if (trigger) {
      setEditData({
        name: trigger.name,
        description: trigger.description || '',
        trigger_type: trigger.trigger_type,
        event_type: trigger.event_type || '',
        config: trigger.config || {},
        pipeline_id: trigger.pipeline_id || '',
        is_active: trigger.is_active,
        metadata: trigger.metadata || {}
      })
    }
  }, [trigger])

  // Handle save
  const handleSave = async () => {
    try {
      const url = isCreateMode 
        ? '/api/triggers?action=create'
        : `/api/triggers?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      })
      
      if (!response.ok) throw new Error('Failed to save trigger')
      
      if (isCreateMode) {
        // Navigate to the new trigger
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/triggers/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving trigger:', error)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/triggers')
      return
    }
    
    // Reset edit data to original values
    if (trigger) {
      setEditData({
        name: trigger.name,
        description: trigger.description || '',
        trigger_type: trigger.trigger_type,
        event_type: trigger.event_type || '',
        config: trigger.config || {},
        pipeline_id: trigger.pipeline_id || '',
        is_active: trigger.is_active,
        metadata: trigger.metadata || {}
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
      const response = await apiFetch(`/api/triggers?action=delete&id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete trigger')
      return response.json()
    },
    {
      onSuccess: () => {
        navigate('/admin/configs/triggers')
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
        <div className="font-semibold">Failed to load trigger</div>
        <div className="mt-1">Error: {String(error)}</div>
      </div>
    )
  }

  if (!trigger) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-slate-900">Trigger not found</h3>
        <p className="mt-2 text-sm text-slate-500">The trigger you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/admin/configs/triggers')}
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
        return <LinkIcon className="h-5 w-5 text-green-500" />
      case 'event':
        return <BoltIcon className="h-5 w-5 text-yellow-500" />
      case 'manual':
        return <UserIcon className="h-5 w-5 text-purple-500" />
      default:
        return <PlayIcon className="h-5 w-5 text-slate-500" />
    }
  }

  const getTriggerBadgeColor = (triggerType: string) => {
    switch (triggerType) {
      case 'schedule':
        return 'primary'
      case 'webhook':
        return 'success'
      case 'event':
        return 'warning'
      case 'manual':
        return 'default'
      default:
        return 'default'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/configs/triggers')}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{trigger.name || 'New Trigger'}</h1>
            <p className="text-sm text-slate-600">Trigger Details</p>
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

      {/* Trigger Info */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-medium text-slate-900">Trigger Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-500">Basic Info</h3>
              <dl className="mt-2 space-y-4">
                {!isCreateMode && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-slate-600">ID:</dt>
                    <dd className="text-sm text-slate-900 font-mono">{trigger.id}</dd>
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
                    <dd className="text-sm text-slate-900">{trigger.name}</dd>
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
                    <dd className="text-sm text-slate-900">{trigger.description || 'No description'}</dd>
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
                        {getTriggerIcon(trigger.trigger_type)}
                        <Badge variant={getTriggerBadgeColor(trigger.trigger_type) as any}>
                          {trigger.trigger_type}
                        </Badge>
                      </div>
                    </dd>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <dt className="text-sm text-slate-600">Event Type:</dt>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.event_type}
                      onChange={(e) => setEditData({...editData, event_type: e.target.value})}
                      className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter event type"
                    />
                  ) : (
                    <dd className="text-sm text-slate-900">{trigger.event_type || 'No event type'}</dd>
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
                      <Badge variant={trigger.is_active ? 'success' : 'default'}>
                        {trigger.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </dd>
                  )}
                </div>
                
                {!isCreateMode && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Pipeline:</dt>
                      <dd className="text-sm text-slate-900">{trigger.pipeline_name || 'No pipeline'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Trigger Count:</dt>
                      <dd className="text-sm text-slate-900">{trigger.trigger_count || 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Last Triggered:</dt>
                      <dd className="text-sm text-slate-900">{trigger.last_triggered ? formatDateTime(trigger.last_triggered) : 'Never'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-slate-600">Created:</dt>
                      <dd className="text-sm text-slate-900">{formatDateTime(trigger.created_at)}</dd>
                    </div>
                    {trigger.updated_at && (
                      <div className="flex justify-between">
                        <dt className="text-sm text-slate-600">Updated:</dt>
                        <dd className="text-sm text-slate-900">{formatDateTime(trigger.updated_at)}</dd>
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
                  {JSON.stringify(trigger.config || {}, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Trigger configuration contains {Object.keys(trigger.config || {}).length} properties
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
                Additional Metadata (JSON)
              </label>
              <textarea
                value={JSON.stringify(editData.metadata, null, 2)}
                onChange={(e) => {
                  try {
                    const metadata = JSON.parse(e.target.value)
                    setEditData({...editData, metadata})
                  } catch (error) {
                    // Invalid JSON, don't update state
                  }
                }}
                className="w-full h-32 font-mono text-sm border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter valid JSON for additional metadata..."
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter valid JSON for additional trigger metadata.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono text-slate-800 whitespace-pre-wrap">
                  {JSON.stringify(trigger.metadata || {}, null, 2)}
                </pre>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Metadata contains {Object.keys(trigger.metadata || {}).length} properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Trigger"
        description="Are you sure you want to delete this trigger? This action cannot be undone."
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
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? 'Deleting...' : 'Delete Trigger'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
