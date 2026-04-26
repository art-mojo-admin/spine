import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Popover } from '../ui/Popover'
import {
  HomeIcon,
  CubeIcon,
  UserGroupIcon,
  CogIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowRightOnRectangleIcon,
  BuildingOfficeIcon,
  ArrowPathIcon,
  BoltIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  LinkIcon,
  UserIcon,
  EllipsisVerticalIcon,
  ShieldCheckIcon,
  KeyIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
]

const configsNavigation = [
  // Types
  { name: 'Item Types', href: '/admin/configs/types', icon: CubeIcon },
  { divider: true },
  // Core Platform
  { name: 'Apps', href: '/admin/configs/apps', icon: CogIcon },
  { name: 'Roles', href: '/admin/configs/roles', icon: ShieldCheckIcon },
  { divider: true },
  // AI/ML
  { name: 'AI Agents', href: '/admin/configs/ai-agents', icon: SparklesIcon },
  { name: 'Prompt Configs', href: '/admin/configs/prompts', icon: DocumentTextIcon },
  { name: 'Embeddings', href: '/admin/configs/embeddings', icon: DocumentTextIcon },
  { divider: true },
  // Automation
  { name: 'Pipelines', href: '/admin/configs/pipelines', icon: ArrowPathIcon },
  { name: 'Triggers', href: '/admin/configs/triggers', icon: BoltIcon },
  { name: 'Timers', href: '/admin/configs/timers', icon: ClockIcon },
  { divider: true },
  // Integrations
  { name: 'Integrations', href: '/admin/configs/integrations', icon: LinkIcon },
  { name: 'API Keys', href: '/admin/configs/api-keys', icon: KeyIcon },
] as const

const observabilityNavigation = [
  { name: 'Executions', href: '/admin/observability/executions', icon: BeakerIcon },
  { name: 'Logs', href: '/admin/observability/logs', icon: DocumentTextIcon },
]

// Database entities that should be shown in runtime navigation
const runtimeNavigation = [
  // Core entities
  { name: 'Accounts', href: '/admin/runtime/accounts', icon: BuildingOfficeIcon },
  { name: 'People', href: '/admin/runtime/people', icon: UserGroupIcon },
  { name: 'Items', href: '/admin/runtime/items', icon: CubeIcon },
  { divider: true },
  // Communication
  { name: 'Threads', href: '/admin/runtime/threads', icon: DocumentTextIcon },
  { name: 'Messages', href: '/admin/runtime/messages', icon: DocumentTextIcon },
  { divider: true },
  // Relationships
  { name: 'Links', href: '/admin/runtime/links', icon: LinkIcon },
  { name: 'Attachments', href: '/admin/runtime/attachments', icon: DocumentTextIcon },
  { divider: true },
  // Activity
  { name: 'Watchers', href: '/admin/runtime/watchers', icon: UserIcon },
] as const

/* ── shared nav item classes ────────────────────────────────── */
function navClasses(active: boolean) {
  return active
    ? 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-navy/10 text-navy border-l-2 border-navy no-underline'
    : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 border-l-2 border-transparent hover:border-accent-blue transition-all duration-200 no-underline'
}

/* ── Sidebar shell ──────────────────────────────────────────── */
export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/')

  const inner = (
    <SidebarContent isActive={isActive} user={user} logout={logout} onClose={onClose} />
  )

  return (
    <>
      {/* ── Mobile: slide-over drawer ── */}
      {open && (
        <aside className="fixed top-0 left-0 z-50 h-full w-60 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out translate-x-0">
          <button
            onClick={onClose}
            className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          {inner}
        </aside>
      )}
    </>
  )
}

/* ── Sidebar inner content ──────────────────────────────────── */
export function SidebarContent({
  isActive,
  user,
  logout,
  onClose,
}: {
  isActive: (href: string) => boolean
  user: any
  logout: () => void
  onClose?: () => void
}) {
  const [configsOpen, setConfigsOpen] = useState(false)
  const [observabilityOpen, setObservabilityOpen] = useState(false)
  const [runtimeOpen, setRuntimeOpen] = useState(true)

  return (
    <div className="flex h-full flex-col">
      {/* ── Brand ── */}
      <div className="flex h-14 shrink-0 items-center px-5">
        <img src="/spine-logo.jpg" alt="Spine Framework" className="h-8 w-auto" />
        <span className="ml-3 text-lg font-semibold tracking-tight text-slate-900">Spine Framework</span>
      </div>

      {/* ── Scrollable nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide">
        {/* Main */}
        <div className="mb-6">
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.name}>
                  <Link to={item.href} className={navClasses(isActive(item.href))} onClick={onClose}>
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>

        {/* Runtime Data */}
        {user?.roles?.includes('system_admin') && (
          <div className="mb-6">
            <button
              onClick={() => setRuntimeOpen(!runtimeOpen)}
              className="mb-2 flex w-full items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-0 p-0 m-0"
            >
              {runtimeOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              Runtime
            </button>
            {runtimeOpen && (
              <div className="space-y-0.5">
                {runtimeNavigation.map((item, index) => {
                  if ('divider' in item) {
                    return <div key={`runtime-divider-${index}`} className="my-3 h-px bg-slate-100" />
                  }
                  const Icon = item.icon
                  return (
                    <div key={item.name}>
                      <Link to={item.href} className={navClasses(isActive(item.href))} onClick={onClose}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.name}
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Configs */}
        {user?.roles?.includes('system_admin') && (
          <div className="mb-6">
            <button
              onClick={() => setConfigsOpen(!configsOpen)}
              className="mb-2 flex w-full items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-0 p-0 m-0"
            >
              {configsOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              Configs
            </button>
            {configsOpen && (
              <div className="space-y-0.5">
                {configsNavigation.map((item, index) => {
                  if ('divider' in item) {
                    return <div key={`divider-${index}`} className="my-3 h-px bg-slate-100" />
                  }
                  const Icon = item.icon
                  return (
                    <div key={item.name}>
                      <Link to={item.href} className={navClasses(isActive(item.href))} onClick={onClose}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.name}
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Observability */}
        {user?.roles?.includes('system_admin') && (
          <div className="mb-6">
            <button
              onClick={() => setObservabilityOpen(!observabilityOpen)}
              className="mb-2 flex w-full items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-0 p-0 m-0"
            >
              {observabilityOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
              Observability
            </button>
            {observabilityOpen && (
              <div className="space-y-0.5">
                {observabilityNavigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.name}>
                      <Link to={item.href} className={navClasses(isActive(item.href))} onClick={onClose}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.name}
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </nav>

      {/* ── User footer ── */}
      <div className="shrink-0 border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <UserIcon className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <span className="block truncate text-sm text-slate-700">{user?.email}</span>
              <span className="block truncate text-xs text-slate-500">KP Tenant</span>
            </div>
          </div>
          <Popover
            trigger={
              <button className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <EllipsisVerticalIcon className="h-4 w-4" />
              </button>
            }
            placement="top-end"
          >
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Sign out
            </button>
          </Popover>
        </div>
      </div>
    </div>
  )
}
