import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { formatDateTime } from '../../lib/utils'

interface PromptConfig {
  id: string
  name: string
  description?: string
  prompt_type: string
  category: string
  template: string
  variables: string[]
  model_config: Record<string, any>
  is_default: boolean
  is_active: boolean
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

const PROMPT_TYPES = [
  { value: 'system', label: 'System' },
  { value: 'user', label: 'User' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'function', label: 'Function' },
  { value: 'general', label: 'General' }
]

export function PromptConfigDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt_type: 'general',
    category: 'general',
    template: '',
    variables: '',
    model_config: '{}',
    is_default: false,
    is_active: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: config, loading, error } = useApi<PromptConfig>(
    async () => {
      if (isCreateMode) return null
      const response = await apiFetch(`/api/prompt-configs?action=get&id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const result = await response.json()
      return result.data || result
    },
    { immediate: !isCreateMode }
  )

  useEffect(() => {
    if (config) {
      setFormData({
        name: config.name || '',
        description: config.description || '',
        prompt_type: config.prompt_type || 'general',
        category: config.category || 'general',
        template: config.template || '',
        variables: (config.variables || []).join(', '),
        model_config: JSON.stringify(config.model_config || {}, null, 2),
        is_default: config.is_default || false,
        is_active: config.is_active
      })
    }
  }, [config])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const body = {
        ...formData,
        variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean),
        model_config: JSON.parse(formData.model_config)
      }
      const url = isCreateMode ? '/api/prompt-configs' : `/api/prompt-configs?id=${id}`
      const response = await apiFetch(url, {
        method: isCreateMode ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Failed to save')
      const result = await response.json()
      navigate(isCreateMode ? `/admin/configs/prompts/${result.config_id || result.id}` : -1)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
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
          Failed to load: {error}
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
          {isCreateMode ? 'Create Prompt Config' : config?.name || 'Prompt Config'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-blue-500" />
            Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={formData.prompt_type}
                onChange={(e) => setFormData({ ...formData, prompt_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              >
                {PROMPT_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Variables</label>
              <input
                type="text"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                placeholder="var1, var2, var3"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Template</h2>
          <textarea
            value={formData.template}
            onChange={(e) => setFormData({ ...formData, template: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
            rows={10}
            placeholder="Enter prompt template with {{variables}}"
            required
          />
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Model Config (JSON)</h2>
          <textarea
            value={formData.model_config}
            onChange={(e) => setFormData({ ...formData, model_config: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-sm"
            rows={6}
          />
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Options</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Default for type</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>

        {!isCreateMode && config && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Info</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-slate-500">Created</dt><dd>{formatDateTime(config.created_at)}</dd></div>
              <div><dt className="text-slate-500">Updated</dt><dd>{formatDateTime(config.updated_at)}</dd></div>
            </dl>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner className="w-4 h-4 mr-2" /> : null}
            {isCreateMode ? 'Create' : 'Update'}
          </Button>
        </div>
      </form>
    </div>
  )
}
