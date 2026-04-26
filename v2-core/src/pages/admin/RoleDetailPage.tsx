import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ArrowLeftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'

interface Role {
  id: string
  name: string
  slug: string
  description?: string
  permissions?: Record<string, any>
  is_system: boolean
  is_active: boolean
  app_id?: string
  created_at: string
  updated_at: string
}

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    is_system: false,
    is_active: true,
    permissions: {}
  })
  const [permissionsJson, setPermissionsJson] = useState('{}')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: role, loading, error: fetchError } = useApi<Role>(
    async () => {
      if (isCreateMode) return null
      const response = await apiFetch(`/api/roles?action=get&id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch role')
      const result = await response.json()
      return result.data
    },
    { immediate: !isCreateMode }
  )

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || '',
        slug: role.slug || '',
        description: role.description || '',
        is_system: role.is_system || false,
        is_active: role.is_active !== false,
        permissions: role.permissions || {}
      })
      setPermissionsJson(JSON.stringify(role.permissions || {}, null, 2))
    }
  }, [role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate permissions JSON
      let parsedPermissions
      try {
        parsedPermissions = JSON.parse(permissionsJson)
      } catch (e) {
        throw new Error('Invalid JSON in permissions field')
      }

      const payload = {
        ...formData,
        permissions: parsedPermissions
      }

      const url = isCreateMode ? '/api/roles' : `/api/roles?id=${id}`
      const method = isCreateMode ? 'POST' : 'PATCH'

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save role')
      }

      const result = await response.json()
      navigate(`/admin/configs/roles/${result.id || id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to save role')
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

  if (fetchError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load role: {fetchError}
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
          {isCreateMode ? 'Create Role' : role?.name || 'Role Detail'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-blue-500" />
            Basic Information
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
                placeholder="e.g., Sales Manager"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="e.g., sales_manager"
                required
                disabled={!isCreateMode}
              />
              {!isCreateMode && (
                <p className="text-xs text-slate-500 mt-1">Slug cannot be changed after creation</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe what this role can do..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Settings</h2>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_system}
                onChange={(e) => setFormData({ ...formData, is_system: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                disabled={!isCreateMode}
              />
              <span className="text-sm text-slate-700">System Role</span>
              <span className="text-xs text-slate-500">(Cannot be deleted, reserved for core functions)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Active</span>
            </label>
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Permissions (JSON)</h2>
          <p className="text-sm text-slate-500 mb-3">
            Define permissions as a JSON object. Each key is a type slug, value is an array of allowed actions.
          </p>
          <textarea
            value={permissionsJson}
            onChange={(e) => setPermissionsJson(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder={`{\n  "item": ["read", "write"],\n  "account": ["read"]\n}`}
            rows={10}
          />
          <p className="text-xs text-slate-500 mt-2">
            Example: <code className="bg-slate-100 px-1 py-0.5 rounded">{`{"support_ticket": ["read", "write", "admin"]}`}</code>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Saving...
              </>
            ) : (
              isCreateMode ? 'Create Role' : 'Update Role'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
