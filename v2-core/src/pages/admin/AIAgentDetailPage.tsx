import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ArrowLeftIcon, PencilIcon } from '@heroicons/react/24/outline'

interface AIAgent {
  id: string
  name: string
  description?: string
  agent_type: 'chat' | 'analysis' | 'automation' | 'custom'
  model_config: {
    model: string
    max_tokens?: number
    temperature?: number
  }
  system_prompt: string
  tools: string[]
  capabilities?: Record<string, any>
  constraints?: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  account_id: string
  app_id?: string
  metadata?: Record<string, any>
}

export function AIAgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>({})

  const { data: agent, loading, error, refetch } = useApi(
    async () => {
      if (isCreateMode) {
        // Return empty agent for create mode
        return {
          id: '',
          name: '',
          description: '',
          agent_type: 'chat' as const,
          model_config: {
            model: 'gpt-4',
            max_tokens: 2048,
            temperature: 0.7
          },
          system_prompt: '',
          tools: [],
          capabilities: {},
          constraints: {},
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: '',
          account_id: '',
          metadata: {}
        }
      }
      
      const response = await apiFetch(`/api/ai-agents?method=GET&id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch AI agent')
      const result = await response.json()
      return result.data
    },
    { immediate: !isCreateMode }
  )

  // Initialize edit data when agent loads
  useEffect(() => {
    if (agent) {
      setEditData({
        name: agent.name,
        description: agent.description || '',
        agent_type: agent.agent_type,
        model_config: agent.model_config || {
          model: 'gpt-4',
          max_tokens: 2048,
          temperature: 0.7
        },
        system_prompt: agent.system_prompt,
        tools: agent.tools || [],
        capabilities: agent.capabilities || {},
        constraints: agent.constraints || {},
        is_active: agent.is_active,
        metadata: agent.metadata || {}
      })
    }
  }, [agent])

  // Handle save
  const handleSave = async () => {
    try {
      const url = isCreateMode 
        ? '/api/ai-agents?action=create'
        : `/api/ai-agents?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      })
      
      if (!response.ok) throw new Error('Failed to save AI agent')
      
      if (isCreateMode) {
        // Navigate to the new agent
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/ai-agents/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving AI agent:', error)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/ai-agents')
      return
    }
    
    // Reset edit data to original values
    if (agent) {
      setEditData({
        name: agent.name,
        description: agent.description || '',
        agent_type: agent.agent_type,
        model_config: agent.model_config || {
          model: 'gpt-4',
          max_tokens: 2048,
          temperature: 0.7
        },
        system_prompt: agent.system_prompt,
        tools: agent.tools || [],
        capabilities: agent.capabilities || {},
        constraints: agent.constraints || {},
        is_active: agent.is_active,
        metadata: agent.metadata || {}
      })
    }
    setIsEditing(false)
  }

  // Handle edit button click
  const handleEdit = () => {
    setIsEditing(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load AI agent: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => isCreateMode ? navigate('/admin/configs/ai-agents') : navigate(-1)}>
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isCreateMode ? 'Create AI Agent' : agent?.name || 'AI Agent Detail'}
            </h1>
            <p className="text-sm text-slate-600">AI Agent Configuration</p>
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
              <Button
                variant="outline"
                onClick={handleEdit}
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )
          )}
        </div>
      </div>

      {isCreateMode ? (
        <div className="bg-white rounded-lg border p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    placeholder="Enter agent name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={editData.agent_type || 'chat'}
                    onChange={(e) => setEditData({...editData, agent_type: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  >
                    <option value="chat">Chat</option>
                    <option value="analysis">Analysis</option>
                    <option value="automation">Automation</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  rows={3}
                  placeholder="Describe what this agent does"
                />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4">Model Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                  <select
                    value={editData.model_config?.model || 'gpt-4'}
                    onChange={(e) => setEditData({
                      ...editData,
                      model_config: {
                        ...editData.model_config,
                        model: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  >
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={editData.model_config?.max_tokens || 2048}
                    onChange={(e) => setEditData({
                      ...editData,
                      model_config: {
                        ...editData.model_config,
                        max_tokens: parseInt(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={editData.model_config?.temperature || 0.7}
                    onChange={(e) => setEditData({
                      ...editData,
                      model_config: {
                        ...editData.model_config,
                        temperature: parseFloat(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4">System Prompt</h3>
              <textarea
                value={editData.system_prompt || ''}
                onChange={(e) => setEditData({...editData, system_prompt: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue"
                rows={6}
                placeholder="Enter the system prompt that defines the agent's behavior"
              />
            </div>
          </div>
        </div>
      ) : agent ? (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Basic Information</h3>
                <dl className="space-y-4">
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Name:</dt>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900 font-medium">{agent.name}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Type:</dt>
                    {isEditing ? (
                      <select
                        value={editData.agent_type || agent.agent_type}
                        onChange={(e) => setEditData({...editData, agent_type: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      >
                        <option value="chat">Chat</option>
                        <option value="analysis">Analysis</option>
                        <option value="automation">Automation</option>
                        <option value="custom">Custom</option>
                      </select>
                    ) : (
                      <dd className="text-sm text-slate-900">{agent.agent_type}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-start">
                    <dt className="text-sm text-slate-600">Description:</dt>
                    {isEditing ? (
                      <textarea
                        value={editData.description || ''}
                        onChange={(e) => setEditData({...editData, description: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                        rows={3}
                      />
                    ) : (
                      <dd className="text-sm text-slate-900 max-w-xs">{agent.description || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Active:</dt>
                    {isEditing ? (
                      <select
                        value={editData.is_active?.toString() || agent.is_active.toString()}
                        onChange={(e) => setEditData({...editData, is_active: e.target.value === 'true'})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <dd className="text-sm text-slate-900">{agent.is_active ? 'Yes' : 'No'}</dd>
                    )}
                  </div>
                </dl>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Model Configuration</h3>
                <dl className="space-y-4">
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Model:</dt>
                    {isEditing ? (
                      <select
                        value={editData.model_config?.model || agent.model_config?.model}
                        onChange={(e) => setEditData({
                          ...editData,
                          model_config: {
                            ...editData.model_config,
                            model: e.target.value
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                      >
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                      </select>
                    ) : (
                      <dd className="text-sm text-slate-900">{agent.model_config?.model || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Max Tokens:</dt>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.model_config?.max_tokens || agent.model_config?.max_tokens}
                        onChange={(e) => setEditData({
                          ...editData,
                          model_config: {
                            ...editData.model_config,
                            max_tokens: parseInt(e.target.value)
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue w-20"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900">{agent.model_config?.max_tokens || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Temperature:</dt>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={editData.model_config?.temperature || agent.model_config?.temperature}
                        onChange={(e) => setEditData({
                          ...editData,
                          model_config: {
                            ...editData.model_config,
                            temperature: parseFloat(e.target.value)
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-blue w-20"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900">{agent.model_config?.temperature || '—'}</dd>
                    )}
                  </div>
                </dl>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">System Prompt</h3>
            {isEditing ? (
              <textarea
                value={editData.system_prompt || agent.system_prompt}
                onChange={(e) => setEditData({...editData, system_prompt: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-blue font-mono text-sm"
                rows={8}
              />
            ) : (
              <div className="bg-slate-50 rounded-md p-4 font-mono text-sm text-slate-700 whitespace-pre-wrap">
                {agent.system_prompt}
              </div>
            )}
          </div>
          
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Additional Information</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><dt className="text-sm text-slate-500">ID</dt><dd className="font-mono text-sm">{agent.id}</dd></div>
              <div><dt className="text-sm text-slate-500">Created</dt><dd className="font-mono text-sm">{new Date(agent.created_at).toLocaleString()}</dd></div>
              <div><dt className="text-sm text-slate-500">Updated</dt><dd className="font-mono text-sm">{new Date(agent.updated_at).toLocaleString()}</dd></div>
              <div><dt className="text-sm text-slate-500">Account ID</dt><dd className="font-mono text-sm">{agent.account_id}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  )
}
