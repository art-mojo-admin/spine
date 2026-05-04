import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

const CRMDashboard = lazy(() => import('./pages/CRMDashboard'))
const DealsPage = lazy(() => import('./pages/DealsPage'))
const DealDetailPage = lazy(() => import('./pages/DealDetailPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const HealthPage = lazy(() => import('./pages/HealthPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))

const NAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/crm/dashboard', icon: '▦' },
  { id: 'deals', label: 'Deals', path: '/crm/deals', icon: '💼' },
  { id: 'contacts', label: 'Contacts', path: '/crm/contacts', icon: '👥' },
  { id: 'health', label: 'Health', path: '/crm/health', icon: '❤️' },
  { id: 'activity', label: 'Activity', path: '/crm/activity', icon: '📊' },
]

function CRMSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`${collapsed ? 'w-14' : 'w-56'} flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col transition-all duration-200`}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
        {!collapsed && <span className="font-semibold text-sm tracking-wide">Spine CRM</span>}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto text-slate-400 hover:text-white text-xs p-1"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      <nav className="flex-1 py-3">
        {NAV.map(item => {
          const active = location.pathname.startsWith(item.path)
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default function CRMApp() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <CRMSidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><LoadingSpinner /></div>}>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CRMDashboard />} />
            <Route path="deals/new" element={<DealDetailPage />} />
            <Route path="deals/:id" element={<DealDetailPage />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
