import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ArrowLeftIcon, KeyIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'

interface APIKey {
  id: string
  name: string
  key_type: 'public' | 'private'
  key_value?: string
  key_prefix: string
  is_active: boolean
  permissions?: Record<string, any>
  rate_limit: number
  expires_at?: string
  last_used_at?: string
  usage_count: number
  integration_id?: string
  metadata?: Record<string, any>
  created_by_person?: { id: string; full_name: string; email: string }
  created_at: string
  updated_at: string
}

const KEY_TYPE_OPTIONS = [
  { value: 'private', label: 'Private (Server-side)' },
  { value: 'public', label: 'Public (Client-side)' }
]

export function APIKeyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'

  const [formData, setFormData] = useState({
    name: '',
    key_type: 'private' as 'public' | 'private',
    key_prefix: 'sk_',
    rate_limit: 1000,
    expires_at: '',
    integration_id: '',
    permissions: {},
    metadata: {},
    is_active: true
  })
  const [permissionsJson, setPermissionsJson] = useState('{}')
  const [metadataJson, setMetadataJson] = useState('{}')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const { data: apiKey, loading, error: fetchError } = useApi<APIKey>(
    async () => {
      if (isCreateMode) return null
      const response = await apiFetch(`/api/api-keys?action=get&id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch API key')
      const result = await response.json()
      return result.data || result
    },
    { immediate: !isCreateMode }
  )

  useEffect(() => {
    if (apiKey) {
      setFormData({
        name: apiKey.name || '',
        key_type: apiKey.key_type || 'private',
        key_prefix: apiKey.key_prefix || 'sk_',
        rate_limit: apiKey.rate_limit || 1000,
        expires_at: apiKey.expires_at ? apiKey.expires_at.split('T')[0] : '',
        integration_id: apiKey.integration_id || '',
        permissions: apiKey.permissions || {},
        metadata: apiKey.metadata || {},
        is_active: apiKey.is_active
      })
      setPermissionsJson(JSON.stringify(apiKey.permissions || {}, null, 2))
      setMetadataJson(JSON.stringify(apiKey.metadata || {}, null, 2))
    }
  }, [apiKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      let permissions, metadata
      try {
        permissions = JSON.parse(permissionsJson)
        metadata = JSON.parse(metadataJson)
      } catch (e) {
        throw new Error('Invalid JSON in permissions or metadata field')
      }

      const payload = {
        ...formData,
        permissions,
        metadata,
        expires_at: formData.expires_at || null
      }

      const response = await apiFetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create API key')
      }

      const result = await response.json()
      setGeneratedKey(result.api_key || result[0]?.api_key_value)
    } catch (err: any) {
      setError(err.message || 'Failed to create API key')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this API key?')) return
    
    try {
      const response = await apiFetch('/api/api-keys?action=revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!response.ok) throw new Error('Failed to revoke API key')
      navigate('/admin/configs/api-keys')
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key')
    }
  }

  const handleRotate = async () => {
    if (!confirm('Are you sure you want to rotate this API key?')) return
    
    try {
      const response = await apiFetch('/api/api-keys?action=rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (!response.ok) throw new Error('Failed to rotate API key')
      const result = await response.json()
      setGeneratedKey(result.api_key || result[0]?.api_key_value)
    } catch (err: any) {
      setError(err.message || 'Failed to rotate API key')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner className="w-8 h-8" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load API key: {fetchError}
        </div>
      </div>
    )
  }

  if (generatedKey) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <KeyIcon className="mx-auto h-12 w-12 text-green-600 mb-4" />
          <h2 className="text-xl font-semibold text-green-900 mb-2">API Key Generated</h2>
          <p className="text-green-700 mb-4">Copy this key now. You won't be able to see it again.</p>
          <div className="bg-white rounded-lg border p-4 mb-4">
            <code className="font-mono text-sm break-all">{generatedKey}</code>
          </div>
          <div className="flex justify-center gap-3">
            <Button onClick={() => copyToClipboard(generatedKey)}>
              Copy to Clipboard
            </Button>
            <Button variant="secondary" onClick={() => navigate('/admin/configs/api-keys')}>
              Done
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">
          {isCreateMode ? 'Generate API Key' : apiKey?.name || 'API Key Detail'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <KeyIcon className="w-5 h-5 text-blue-500" />
            Key Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Production API Key"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Key Type</label>
              <select
                value={formData.key_type}
                onChange={(e) => setFormData({ ...formData, key_type: e.target.value as 'public' | 'private' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {KEY_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate Limit (req/min)</label>
              <input
                type="number"
                value={formData.rate_limit}
                onChange={(e) => setFormData({ ...formData, rate_limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {!isCreateMode && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Actions</h2>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={handleRotate} className="flex items-center gap-2">
                <ArrowPathIcon className="w-4 h-4" />
                Rotate Key
              </Button>
              <Button type="button" variant="secondary" onClick={handleRevoke} className="flex items-center gap-2 text-red-600">
                <TrashIcon className="w-4 h-4" />
                Revoke Key
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          {isCreateMode && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner className="w-4 h-4 mr-2" /> : null}
              Generate Key
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
