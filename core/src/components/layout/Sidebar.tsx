import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { APP_NAME } from '@/lib/config'
import {
  Building2,
  Users,
  Activity,
  Webhook,
  Settings,
  Shield,
  UserPlus,
  ArrowDownToLine,
  SlidersHorizontal,
  Link2,
  Package,
  Search,
  LogOut,
  ChevronDown,
  ShieldAlert,
  HeartPulse,
  ShieldCheck,
  Bot,
  UserCheck,
  LayoutDashboard,
  Grid3x3,
  Zap,
  Clock,
  PlugZap,
  Send,
  Activity as ActivityIcon,
  Puzzle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useImpersonation } from '@/hooks/useImpersonation'
import { AccountNodePanel } from '@/components/layout/AccountNodePanel'
// Core navigation sections
function getCustomNavSections() {
  return []
}
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const ROLE_RANK: Record<string, number> = {
  portal: 0,
  member: 1,
  operator: 2,
  admin: 3,
  system_admin: 4,
  system_operator: 4,
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Users,
  Activity,
  Webhook,
  Settings,
  Shield,
  UserPlus,
  ArrowDownToLine,
  SlidersHorizontal,
  Link2,
  Package,
  Search,
  LogOut,
  ChevronDown,
  ShieldAlert,
  HeartPulse,
  ShieldCheck,
  Bot,
  UserCheck,
  LayoutDashboard,
  Grid3x3,
}

const coreNavItems = [
  { key: 'accounts', to: '/accounts', icon: Building2, label: 'Accounts' },
  { key: 'persons', to: '/persons', icon: Users, label: 'Persons' },
  { key: 'activity', to: '/activity', icon: Activity, label: 'Activity' },
  { key: 'search', to: '/search', icon: Search, label: 'Search' },
]

const adminItems: { to: string; icon: any; label: string }[] = [
  { to: '/admin/members', icon: UserPlus, label: 'Members' },
  { to: '/admin/roles', icon: Shield, label: 'Roles' },
  { to: '/admin/role-matrix', icon: Grid3x3, label: 'Role Matrix' },
  { to: '/admin/machine-principals', icon: Bot, label: 'Machine Principals' },
  { to: '/admin/scopes', icon: Shield, label: 'Scope Library' },
  { to: '/admin/account-scopes', icon: ShieldCheck, label: 'Account Scopes' },
  { to: '/admin/principal-scopes', icon: UserCheck, label: 'Principal Scopes' },
  { to: '/admin/field-definitions', icon: SlidersHorizontal, label: 'Field Definitions' },
  { to: '/admin/link-types', icon: Link2, label: 'Link Types' },
  { to: '/admin/packs', icon: Package, label: 'Packs' },
  { to: '/admin/webhooks', icon: Webhook, label: 'Webhooks' },
  { to: '/admin/inbound-webhooks', icon: ArrowDownToLine, label: 'Inbound Hooks' },
  { to: '/admin/automations', icon: Zap, label: 'Automations' },
  { to: '/admin/schedules', icon: Clock, label: 'Schedules' },
  { to: '/admin/custom-actions', icon: PlugZap, label: 'Custom Actions' },
  { to: '/admin/webhook-deliveries', icon: Send, label: 'Webhook Deliveries' },
  { to: '/admin/scheduler-health', icon: HeartPulse, label: 'Scheduler Health' },
  { to: '/admin/automation-log', icon: ActivityIcon, label: 'Automation Log' },
  { to: '/admin/integrations', icon: Puzzle, label: 'Integrations' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

const manifestNavSections = getCustomNavSections()

export function Sidebar() {
  const { profile, memberships, currentAccountId, setCurrentAccountId, currentRole } = useAuth()
  const { active: isImpersonating } = useImpersonation()
  const currentAccount = memberships.find(m => m.account_id === currentAccountId)?.account
  const isAdmin = currentRole === 'admin' || profile?.system_role === 'system_admin'
  const isSystemAdmin = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'
  const showTenantSwitcher = memberships.length > 1

  const userRank = ROLE_RANK[currentRole ?? profile?.system_role ?? 'member'] ?? 1

  const { primarySections, adminSections } = useMemo(() => {
    const filtered = manifestNavSections
      .map(section => ({
        ...section,
        scope: section.scope ?? 'primary',
        items: section.items.filter(item => {
          const itemRank = ROLE_RANK[item.minRole ?? 'member'] ?? 1
          return userRank >= itemRank
        }),
      }))
      .filter(section => section.items.length > 0)

    const sortSections = (sections: typeof filtered) =>
      sections.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

    return {
      primarySections: sortSections(filtered.filter(section => section.scope === 'primary')),
      adminSections: sortSections(filtered.filter(section => section.scope === 'admin')),
    }
  }, [userRank])

  const renderCustomSections = (sections: typeof primarySections) =>
    sections.map(section => (
      <div key={section.key}>
        <div className="pb-1 pt-3">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {section.title}
          </p>
        </div>
        {section.items.map(item => {
          const Icon = (item.icon && ICON_MAP[item.icon]) || LayoutDashboard
          return (
            <NavLink
              key={`${section.key}-${item.key}`}
              to={item.to}
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
              {item.label}
            </NavLink>
          )
        })}
      </div>
    ))

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
        {/* Core primitive nav */}
        {coreNavItems.map(({ key, to, icon: Icon, label }) => (
          <NavLink
            key={key}
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

        {/* Custom nav sections injected by custom code */}
        {renderCustomSections(primarySections)}

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

            {renderCustomSections(adminSections)}
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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between px-3 py-2"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium">{profile?.display_name}</span>
                <span className="text-xs text-muted-foreground">{currentRole}</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-current" />
                <span className="h-1 w-1 rounded-full bg-current" />
                <span className="h-1 w-1 rounded-full bg-current" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-0">
            <div className="border-b px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account scope</p>
              <AccountNodePanel className="mt-2" />
            </div>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  )
}
