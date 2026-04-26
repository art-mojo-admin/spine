import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { ArrowLeftIcon, ClockIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import { formatDateTime } from '../../lib/utils'

interface Timer {
  id: string
  name: string
  description?: string
  schedule_type: 'cron' | 'interval' | 'once'
  schedule_config: {
    cron?: string
    interval_minutes?: number
    run_at?: string
  }
  action_type: 'webhook' | 'function' | 'pipeline'
  action_config: {
    url?: string
    function_name?: string
    pipeline_id?: string
    payload?: Record<string, any>
  }
  is_active: boolean
  metadata?: Record<string, any>
  last_run_at?: string
  next_run_at?: string
  run_count: number
  app_id?: string
  app?: { id: string; name: string; slug: string }
  created_by_person?: { id: string; full_name: string; email: string }
  created_at: string
  updated_at: string
}

const SCHEDULE_TYPE_OPTIONS = [
  { value: 'cron', label: 'Cron Expression' },
  { value: 'interval', label: 'Interval (minutes)' },
  { value: 'once', label: 'One-time' }
]

const ACTION_TYPE_OPTIONS = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'function', label: 'Function' },
  { value: 'pipeline', label: 'Pipeline' }
]

export function TimerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isCreateMode = !id || id === 'new'

  const { data: timer, loading, error } = useApi(
    async () => {
      if (isCreateMode) return null
      const response = await apiFetch(`/api/timers?action=get&id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch timer')
      const result = await response.json()
      return result.data
    },
    { immediate: !isCreateMode }
  )

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule_type: 'cron' as 'cron' | 'interval' | 'once',
    schedule_config: { cron: '0 9 * * *', interval_minutes: 60, run_at: '' },
    action_type: 'webhook' as 'webhook' | 'function' | 'pipeline',
    action_config: { url: '', function_name: '', pipeline_id: '' },
    is_active: true
  })
  const [payloadJson, setPayloadJson] = useState('{}')
  const [metadataJson, setMetadataJson] = useState('{}')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (timer) {
      setFormData({
        name: timer.name || '',
        description: timer.description || '',
        schedule_type: timer.schedule_type || 'cron',
        schedule_config: timer.schedule_config || { cron: '0 9 * * *', interval_minutes: 60, run_at: '' },
        action_type: timer.action_type || 'webhook',
        action_config: {
          url: timer.action_config?.url || '',
          function_name: timer.action_config?.function_name || '',
          pipeline_id: timer.action_config?.pipeline_id || ''
        },
        is_active: timer.is_active
      })
      setPayloadJson(JSON.stringify(timer.action_config?.payload || {}, null, 2))
      setMetadataJson(JSON.stringify(timer.metadata || {}, null, 2))
    }
  }, [timer])

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
          Failed to load timer: {error}
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      let payload, metadata
      try {
        payload = JSON.parse(payloadJson)
        metadata = JSON.parse(metadataJson)
      } catch {
        alert('Invalid JSON in payload or metadata')
        return
      }

      const body = {
        ...formData,
        action_config: { ...formData.action_config, payload },
        metadata
      }

      const url = isCreateMode ? '/api/timers' : `/api/timers?id=${id}`
      const method = isCreateMode ? 'POST' : 'PATCH'

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Failed to save timer')
      const result = await response.json()
      navigate(isCreateMode ? `/admin/configs/timers/${result.timer_id || result.id}` : -1)
    } catch (error: any) {
      alert(error.message || 'Failed to save timer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeftIcon className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">
          {isCreateMode ? 'Create Timer' : timer?.name || 'Timer Detail'}
        </h1>
      </div>

      {isCreateMode ? (
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-blue-500" />
                Timer Configuration
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Daily Report"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Type</label>
                  <select
                    value={formData.schedule_type}
                    onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SCHEDULE_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="What does this timer do?"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Schedule Settings</h2>
              {formData.schedule_type === 'cron' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cron Expression</label>
                  <input
                    type="text"
                    value={formData.schedule_config.cron}
                    onChange={(e) => setFormData({ ...formData, schedule_config: { ...formData.schedule_config, cron: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="0 9 * * *"
                  />
                  <p className="text-xs text-slate-500 mt-1">min hour day month weekday</p>
                </div>
              )}
              {formData.schedule_type === 'interval' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interval (minutes)</label>
                  <input
                    type="number"
                    value={formData.schedule_config.interval_minutes}
                    onChange={(e) => setFormData({ ...formData, schedule_config: { ...formData.schedule_config, interval_minutes: parseInt(e.target.value) || 60 } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              )}
              {formData.schedule_type === 'once' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Run At</label>
                  <input
                    type="datetime-local"
                    value={formData.schedule_config.run_at}
                    onChange={(e) => setFormData({ ...formData, schedule_config: { ...formData.schedule_config, run_at: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Action Settings</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Action Type</label>
                <select
                  value={formData.action_type}
                  onChange={(e) => setFormData({ ...formData, action_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTION_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {formData.action_type === 'webhook' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
                  <input
                    type="url"
                    value={formData.action_config.url}
                    onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, url: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.example.com/webhook"
                  />
                </div>
              )}
              {formData.action_type === 'function' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Function Name</label>
                  <input
                    type="text"
                    value={formData.action_config.function_name}
                    onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, function_name: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="myFunction"
                  />
                </div>
              )}
              {formData.action_type === 'pipeline' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pipeline ID</label>
                  <input
                    type="text"
                    value={formData.action_config.pipeline_id}
                    onChange={(e) => setFormData({ ...formData, action_config: { ...formData.action_config, pipeline_id: e.target.value } })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="uuid"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payload (JSON)</label>
                <textarea
                  value={payloadJson}
                  onChange={(e) => setPayloadJson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={4}
                  placeholder='{"key": "value"}'
                />
              </div>
            </div>
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Metadata</h2>
              <textarea
                value={metadataJson}
                onChange={(e) => setMetadataJson(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={4}
                placeholder='{"custom": "data"}'
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner className="w-4 h-4 mr-2" /> : null}
                {isCreateMode ? 'Create Timer' : 'Update Timer'}
              </Button>
            </div>
          </div>
        </form>
      ) : timer ? (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Status</span>
                <p className={`font-medium ${timer.is_active ? 'text-green-600' : 'text-slate-600'}`}>
                  {timer.is_active ? 'Active' : 'Paused'}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Last Run</span>
                <p className="font-medium">{timer.last_run_at ? formatDateTime(timer.last_run_at) : 'Never'}</p>
              </div>
              <div>
                <span className="text-slate-500">Next Run</span>
                <p className="font-medium">{timer.next_run_at ? formatDateTime(timer.next_run_at) : '—'}</p>
              </div>
              <div>
                <span className="text-slate-500">Total Runs</span>
                <p className="font-medium">{timer.run_count || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Details</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{timer.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Schedule Type</dt>
                <dd className="font-medium text-slate-900 capitalize">{timer.schedule_type}</dd>
              </div>
              {timer.schedule_type === 'cron' && (
                <div>
                  <dt className="text-slate-500">Cron Expression</dt>
                  <dd className="font-mono text-slate-900">{timer.schedule_config?.cron}</dd>
                </div>
              )}
              {timer.schedule_type === 'interval' && (
                <div>
                  <dt className="text-slate-500">Interval</dt>
                  <dd className="text-slate-900">{timer.schedule_config?.interval_minutes} minutes</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Action Type</dt>
                <dd className="font-medium text-slate-900 capitalize">{timer.action_type}</dd>
              </div>
              {timer.action_type === 'webhook' && (
                <div className="md:col-span-2">
                  <dt className="text-slate-500">Webhook URL</dt>
                  <dd className="font-mono text-slate-900 break-all">{timer.action_config?.url}</dd>
                </div>
              )}
              {timer.action_type === 'function' && (
                <div>
                  <dt className="text-slate-500">Function</dt>
                  <dd className="font-mono text-slate-900">{timer.action_config?.function_name}</dd>
                </div>
              )}
              {timer.action_type === 'pipeline' && (
                <div>
                  <dt className="text-slate-500">Pipeline ID</dt>
                  <dd className="font-mono text-slate-900">{timer.action_config?.pipeline_id}</dd>
                </div>
              )}
              <div className="md:col-span-2">
                <dt className="text-slate-500">Description</dt>
                <dd className="text-slate-900">{timer.description || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-900">{formatDateTime(timer.created_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-900">{formatDateTime(timer.updated_at)}</dd>
              </div>
            </dl>
          </div>

          {timer.action_config?.payload && Object.keys(timer.action_config.payload).length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Payload</h2>
              <pre className="bg-slate-50 p-4 rounded-md text-sm overflow-x-auto">
                {JSON.stringify(timer.action_config.payload, null, 2)}
              </pre>
            </div>
          )}

          {timer.metadata && Object.keys(timer.metadata).length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Metadata</h2>
              <pre className="bg-slate-50 p-4 rounded-md text-sm overflow-x-auto">
                {JSON.stringify(timer.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
