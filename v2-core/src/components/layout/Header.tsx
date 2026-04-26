import { Bars3Icon, BellIcon, MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/outline'
import { User } from '../../types/auth'

interface HeaderProps {
  onMenuClick: () => void
  user: User | null
}

export function Header({ onMenuClick, user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:pl-72 lg:pr-8">
      {/* Logo + Mobile hamburger — only visible below lg */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
              </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-48 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent-blue transition-colors"
          />
        </div>

        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-medium text-white">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || '?'}
          </div>
          <span className="hidden sm:block text-sm font-medium text-slate-700">
            {user?.full_name}
          </span>
        </div>
      </div>
    </header>
  )
}
