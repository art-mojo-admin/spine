import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { APP_NAME } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  KanbanSquare,
  Globe,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react'

const portalNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-items', icon: KanbanSquare, label: 'My Items' },
  { to: '/browse', icon: Globe, label: 'Browse' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export function PortalShell() {
  const { profile, memberships, currentAccountId, setCurrentAccountId } = useAuth()
  const currentAccount = memberships.find(m => m.account_id === currentAccountId)?.account
  const showTenantSwitcher = memberships.length > 1

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-full w-56 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Portal</span>
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
            <p className="text-xs text-muted-foreground">Organization</p>
            <p className="text-sm font-medium">{currentAccount.display_name}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {portalNavItems.map(({ to, icon: Icon, label }) => (
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
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 px-3">
            <p className="text-sm font-medium">{profile?.display_name}</p>
            <p className="text-xs text-muted-foreground">portal</p>
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
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
