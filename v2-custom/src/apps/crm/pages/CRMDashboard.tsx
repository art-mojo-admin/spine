import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../../lib/api'

interface StatCard {
  label: string
  value: string | number
  sub?: string
  color: string
  onClick?: () => void
}

function StatCard({ label, value, sub, color, onClick }: StatCard) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-slate-200 p-5 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}
    >
      <div className={`text-xs font-medium uppercase tracking-wider mb-1 ${color}`}>{label}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-sm text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}

interface Deal {
  id: string
  title: string
  data: { stage?: string; value?: number; close_date?: string }
  created_at: string
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'bg-slate-100 text-slate-700',
  qualification: 'bg-blue-100 text-blue-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  closed_won: 'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-700',
}

export default function CRMDashboard() {
  const navigate = useNavigate()
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/items?action=list&type_slug=deal&limit=50')
      .then(r => r.json())
      .then(json => setDeals(json || []))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false))
  }, [])

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.data?.stage || ''))
  const wonDeals = deals.filter(d => d.data?.stage === 'closed_won')
  const pipeline = openDeals.reduce((sum, d) => sum + (d.data?.value || 0), 0)
  const won = wonDeals.reduce((sum, d) => sum + (d.data?.value || 0), 0)

  const recentDeals = [...deals].slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Pipeline overview and recent activity</p>
        </div>
        <button
          onClick={() => navigate('/crm/deals/new')}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Deal
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Deals"
          value={loading ? '…' : openDeals.length}
          sub="active pipeline"
          color="text-blue-600"
          onClick={() => navigate('/crm/deals')}
        />
        <StatCard
          label="Pipeline Value"
          value={loading ? '…' : `$${(pipeline / 1000).toFixed(0)}k`}
          sub="across open deals"
          color="text-green-600"
        />
        <StatCard
          label="Won (All Time)"
          value={loading ? '…' : wonDeals.length}
          sub={`$${(won / 1000).toFixed(0)}k closed`}
          color="text-emerald-600"
        />
        <StatCard
          label="Total Deals"
          value={loading ? '…' : deals.length}
          sub="all stages"
          color="text-slate-600"
          onClick={() => navigate('/crm/deals')}
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Deals</h2>
          <button onClick={() => navigate('/crm/deals')} className="text-sm text-blue-600 hover:underline">
            View all →
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : recentDeals.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No deals yet.{' '}
            <button onClick={() => navigate('/crm/deals/new')} className="text-blue-600 hover:underline">
              Create your first deal →
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Deal</th>
                <th className="text-left px-5 py-3 font-medium">Stage</th>
                <th className="text-right px-5 py-3 font-medium">Value</th>
                <th className="text-right px-5 py-3 font-medium">Close Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentDeals.map(deal => (
                <tr
                  key={deal.id}
                  onClick={() => navigate(`/crm/deals/${deal.id}`)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-5 py-3 font-medium text-slate-900">{deal.title}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[deal.data?.stage || ''] || 'bg-slate-100 text-slate-600'}`}>
                      {deal.data?.stage?.replace('_', ' ') || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {deal.data?.value ? `$${deal.data.value.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500">
                    {deal.data?.close_date || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
