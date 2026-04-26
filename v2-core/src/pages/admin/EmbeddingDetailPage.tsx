import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ArrowLeftIcon, PencilIcon } from '@heroicons/react/24/outline'

interface EmbeddingModel {
  id: string
  name: string
  description?: string
  model_name: string
  provider: 'openai' | 'anthropic' | 'local' | 'custom'
  config: {
    dimension: number
    chunk_size: number
    overlap: number
    batch_size: number
  }
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  account_id: string
  document_count: number
  embedding_count: number
  storage_size: number
}

export function EmbeddingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'
  
  const [isEditing, setIsEditing] = useState(isCreateMode)
  const [editData, setEditData] = useState<Record<string, any>>({})

  const { data: embedding, loading, error, refetch } = useApi(
    async () => {
      if (isCreateMode) {
        // Return empty embedding for create mode
        return {
          id: '',
          name: '',
          description: '',
          model_name: 'text-embedding-ada-002',
          provider: 'openai' as const,
          config: {
            dimension: 1536,
            chunk_size: 1000,
            overlap: 200,
            batch_size: 100
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: '',
          account_id: '',
          document_count: 0,
          embedding_count: 0,
          storage_size: 0
        }
      }
      
      const response = await apiFetch(`/api/embeddings?action=get&id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch embedding')
      const result = await response.json()
      return result.data
    },
    { immediate: !isCreateMode }
  )

  // Initialize edit data when embedding loads
  useEffect(() => {
    if (embedding) {
      setEditData({
        name: embedding.name,
        description: embedding.description || '',
        model_name: embedding.model_name,
        provider: embedding.provider,
        config: embedding.config || {
          dimension: 1536,
          chunk_size: 1000,
          overlap: 200,
          batch_size: 100
        },
        is_active: embedding.is_active
      })
    }
  }, [embedding])

  // Handle save
  const handleSave = async () => {
    try {
      const url = isCreateMode 
        ? '/api/embeddings?action=create'
        : `/api/embeddings?action=update&id=${id}`
      
      const method = isCreateMode ? 'POST' : 'PATCH'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editData)
      })
      
      if (!response.ok) throw new Error('Failed to save embedding')
      
      if (isCreateMode) {
        // Navigate to the new embedding
        const result = await response.json()
        const newId = result.data?.id || result.id
        navigate(`/admin/configs/embeddings/${newId}`)
      } else {
        await refetch()
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving embedding:', error)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    if (isCreateMode) {
      navigate('/admin/configs/embeddings')
      return
    }
    
    // Reset edit data to original values
    if (embedding) {
      setEditData({
        name: embedding.name,
        description: embedding.description || '',
        model_name: embedding.model_name,
        provider: embedding.provider,
        config: embedding.config || {
          dimension: 1536,
          chunk_size: 1000,
          overlap: 200,
          batch_size: 100
        },
        is_active: embedding.is_active
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
          Failed to load embedding: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => isCreateMode ? navigate('/admin/configs/embeddings') : navigate(-1)}>
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isCreateMode ? 'Create Embedding Model' : embedding?.name || 'Embedding Detail'}
            </h1>
            <p className="text-sm text-slate-600">Embedding Model Configuration</p>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter model name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                  <select
                    value={editData.provider || 'openai'}
                    onChange={(e) => setEditData({...editData, provider: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="local">Local</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe this embedding model"
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Model Name</label>
                <input
                  type="text"
                  value={editData.model_name || ''}
                  onChange={(e) => setEditData({...editData, model_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., text-embedding-ada-002"
                />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4">Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dimensions</label>
                  <input
                    type="number"
                    value={editData.config?.dimension || 1536}
                    onChange={(e) => setEditData({
                      ...editData,
                      config: {
                        ...editData.config,
                        dimension: parseInt(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chunk Size</label>
                  <input
                    type="number"
                    value={editData.config?.chunk_size || 1000}
                    onChange={(e) => setEditData({
                      ...editData,
                      config: {
                        ...editData.config,
                        chunk_size: parseInt(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Overlap</label>
                  <input
                    type="number"
                    value={editData.config?.overlap || 200}
                    onChange={(e) => setEditData({
                      ...editData,
                      config: {
                        ...editData.config,
                        overlap: parseInt(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch Size</label>
                  <input
                    type="number"
                    value={editData.config?.batch_size || 100}
                    onChange={(e) => setEditData({
                      ...editData,
                      config: {
                        ...editData.config,
                        batch_size: parseInt(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : embedding ? (
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
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900 font-medium">{embedding.name}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Provider:</dt>
                    {isEditing ? (
                      <select
                        value={editData.provider || embedding.provider}
                        onChange={(e) => setEditData({...editData, provider: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="local">Local</option>
                        <option value="custom">Custom</option>
                      </select>
                    ) : (
                      <dd className="text-sm text-slate-900">{embedding.provider}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-start">
                    <dt className="text-sm text-slate-600">Description:</dt>
                    {isEditing ? (
                      <textarea
                        value={editData.description || ''}
                        onChange={(e) => setEditData({...editData, description: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    ) : (
                      <dd className="text-sm text-slate-900 max-w-xs">{embedding.description || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Model Name:</dt>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.model_name || embedding.model_name}
                        onChange={(e) => setEditData({...editData, model_name: e.target.value})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900 font-mono">{embedding.model_name}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Active:</dt>
                    {isEditing ? (
                      <select
                        value={editData.is_active?.toString() || embedding.is_active.toString()}
                        onChange={(e) => setEditData({...editData, is_active: e.target.value === 'true'})}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <dd className="text-sm text-slate-900">{embedding.is_active ? 'Yes' : 'No'}</dd>
                    )}
                  </div>
                </dl>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Configuration</h3>
                <dl className="space-y-4">
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Dimensions:</dt>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.config?.dimension || embedding.config?.dimension}
                        onChange={(e) => setEditData({
                          ...editData,
                          config: {
                            ...editData.config,
                            dimension: parseInt(e.target.value)
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900">{embedding.config?.dimension || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Chunk Size:</dt>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.config?.chunk_size || embedding.config?.chunk_size}
                        onChange={(e) => setEditData({
                          ...editData,
                          config: {
                            ...editData.config,
                            chunk_size: parseInt(e.target.value)
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900">{embedding.config?.chunk_size || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Overlap:</dt>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.config?.overlap || embedding.config?.overlap}
                        onChange={(e) => setEditData({
                          ...editData,
                          config: {
                            ...editData.config,
                            overlap: parseInt(e.target.value)
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900">{embedding.config?.overlap || '—'}</dd>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-slate-600">Batch Size:</dt>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.config?.batch_size || embedding.config?.batch_size}
                        onChange={(e) => setEditData({
                          ...editData,
                          config: {
                            ...editData.config,
                            batch_size: parseInt(e.target.value)
                          }
                        })}
                        className="text-sm text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
                      />
                    ) : (
                      <dd className="text-sm text-slate-900">{embedding.config?.batch_size || '—'}</dd>
                    )}
                  </div>
                </dl>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Usage Statistics</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><dt className="text-sm text-slate-500">Documents</dt><dd className="font-mono text-sm">{embedding.document_count}</dd></div>
              <div><dt className="text-sm text-slate-500">Embeddings</dt><dd className="font-mono text-sm">{embedding.embedding_count}</dd></div>
              <div><dt className="text-sm text-slate-500">Storage Size</dt><dd className="font-mono text-sm">{Math.round(embedding.storage_size / 1024 / 1024 * 100) / 100} MB</dd></div>
              <div><dt className="text-sm text-slate-500">Created</dt><dd className="font-mono text-sm">{new Date(embedding.created_at).toLocaleString()}</dd></div>
            </dl>
          </div>
          
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Additional Information</h3>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><dt className="text-sm text-slate-500">ID</dt><dd className="font-mono text-sm">{embedding.id}</dd></div>
              <div><dt className="text-sm text-slate-500">Updated</dt><dd className="font-mono text-sm">{new Date(embedding.updated_at).toLocaleString()}</dd></div>
              <div><dt className="text-sm text-slate-500">Created By</dt><dd className="font-mono text-sm">{embedding.created_by}</dd></div>
              <div><dt className="text-sm text-slate-500">Account ID</dt><dd className="font-mono text-sm">{embedding.account_id}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  )
}
