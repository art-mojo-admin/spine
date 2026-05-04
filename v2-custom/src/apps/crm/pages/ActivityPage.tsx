import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api'

interface ActivityItem {
  id: string
  title: string
  data: Record<string, unknown>
  created_at: string
  type_slug?: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  site_visit:      { label: 'Site Visit',      color: 'bg-purple-100 text-purple-700' },
  marketing_touch: { label: 'Marketing Touch', color: 'bg-yellow-100 text-yellow-700' },
  deal:            { label: 'Deal',            color: 'bg-blue-100 text-blue-700' },
  csm_health:      { label: 'Health Check',    color: 'bg-green-100 text-green-700' },
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/items?action=list&type_slug=site_visit&limit=50').then(r => r.json()),
      apiFetch('/api/items?action=list&type_slug=marketing_touch&limit=50').then(r => r.json()),
    ])
      .then(([visits, touches]) => {
        const all = [
          ...(visits || []).map((i: ActivityItem) => ({ ...i, type_slug: 'site_visit' })),
          ...(touches || []).map((i: ActivityItem) => ({ ...i, type_slug: 'marketing_touch' })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        setItems(all)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Activity Feed</h1>
        <p className="text-slate-500 text-sm mt-1">Site visits and marketing touches</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading activity…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No activity recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const typeInfo = TYPE_LABELS[item.type_slug || ''] || { label: item.type_slug || 'Event', color: 'bg-slate-100 text-slate-600' }
              return (
                <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                  <span className={`flex-shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium mt-0.5 ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{item.title}</div>
                    {item.type_slug === 'site_visit' && item.data?.url && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">{String(item.data.url)}</div>
                    )}
                    {item.type_slug === 'marketing_touch' && item.data?.channel && (
                      <div className="text-xs text-slate-500 mt-0.5">via {String(item.data.channel)}{item.data?.campaign ? ` · ${item.data.campaign}` : ''}</div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
