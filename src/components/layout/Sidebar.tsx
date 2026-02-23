import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { APP_NAME } from '@/lib/config'
import {
  LayoutDashboard,
  Building2,
  Users,
  GitBranch,
  TicketCheck,
  BookOpen,
  Activity,
  Palette,
  Webhook,
  Settings,
  Shield,
  UserPlus,
  Zap,
  ArrowDownToLine,
  SlidersHorizontal,
  Clock,
  Link2,
  Package,
  Search,
  LogOut,
  ChevronDown,
  Puzzle,
  Blocks,
  PlugZap,
  PanelLeftDashed,
  ShieldAlert,
  HeartPulse,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { apiGet } from '@/lib/api'
import { useImpersonation } from '@/hooks/useImpersonation'

interface NavExtensionItem {
  id: string
  label: string
  icon: string | null
  url: string
  location: string
  position: number
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Building2, label: 'Accounts' },
  { to: '/persons', icon: Users, label: 'Persons' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/tickets', icon: TicketCheck, label: 'Tickets' },
  { to: '/kb', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/search', icon: Search, label: 'Search' },
]

const adminItems = [
  { to: '/admin/theme', icon: Palette, label: 'Theme' },
  { to: '/admin/webhooks', icon: Webhook, label: 'Webhooks' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
  { to: '/admin/roles', icon: Shield, label: 'Roles' },
  { to: '/admin/members', icon: UserPlus, label: 'Members' },
  { to: '/admin/automations', icon: Zap, label: 'Automations' },
  { to: '/admin/inbound-webhooks', icon: ArrowDownToLine, label: 'Inbound Hooks' },
  { to: '/admin/custom-fields', icon: SlidersHorizontal, label: 'Custom Fields' },
  { to: '/admin/schedules', icon: Clock, label: 'Schedules' },
  { to: '/admin/link-types', icon: Link2, label: 'Link Types' },
  { to: '/admin/packs', icon: Package, label: 'Templates' },
  { to: '/admin/modules', icon: Blocks, label: 'Modules' },
  { to: '/admin/custom-actions', icon: PlugZap, label: 'Custom Actions' },
  { to: '/admin/nav-extensions', icon: PanelLeftDashed, label: 'Nav Extensions' },
]

export function Sidebar() {
  const { profile, memberships, currentAccountId, setCurrentAccountId, currentRole } = useAuth()
  const { active: isImpersonating } = useImpersonation()
  const currentAccount = memberships.find(m => m.account_id === currentAccountId)?.account
  const isAdmin = currentRole === 'admin' || profile?.system_role === 'system_admin'
  const isSystemAdmin = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'
  const showTenantSwitcher = memberships.length > 1

  const [sidebarExtensions, setSidebarExtensions] = useState<NavExtensionItem[]>([])

  useEffect(() => {
    async function loadExtensions() {
      try {
        const data = await apiGet<NavExtensionItem[]>('nav-extensions', { location: 'sidebar' })
        setSidebarExtensions(data)
      } catch {
        // Silently ignore — extensions are optional
      }
    }
    if (currentAccountId) loadExtensions()
  }, [currentAccountId])

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      {showTenantSwitcher && (
        <div className="border-b p-3">
          <div className="relative">
            <select
              value={currentAccountId || ''}
              onChange={(e) => setCurrentAccountId(e.target.value)}
              className="w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm"
            >
              {memberships.map((m) => (
                <option key={m.account_id} value={m.account_id}>
                  {m.account.display_name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      {!showTenantSwitcher && currentAccount && (
        <div className="border-b px-4 py-3">
          <p className="text-xs text-muted-foreground">Tenant</p>
          <p className="text-sm font-medium">{currentAccount.display_name}</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        {sidebarExtensions.length > 0 && (
          <>
            <div className="pb-1 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Extensions
              </p>
            </div>
            {sidebarExtensions.map((ext) => (
              <NavLink
                key={ext.id}
                to={ext.url}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Puzzle className="h-4 w-4" />
                {ext.label}
              </NavLink>
            ))}
          </>
        )}

        {isAdmin && (
          <>
            <div className="pb-1 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
            </div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </>
        )}

        {isSystemAdmin && !isImpersonating && (
          <>
            <div className="pb-1 pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                System
              </p>
            </div>
            <NavLink
              to="/admin/account-browser"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <ShieldAlert className="h-4 w-4" />
              Account Browser
            </NavLink>
            <NavLink
              to="/admin/system-health"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <HeartPulse className="h-4 w-4" />
              System Health
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 px-3">
          <p className="text-sm font-medium">{profile?.display_name}</p>
          <p className="text-xs text-muted-foreground">{currentRole}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
