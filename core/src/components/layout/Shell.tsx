import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useImpersonation } from '@/hooks/useImpersonation'
import { ActiveAppProvider } from '@/hooks/useActiveApp'
import { ActiveAppNotice, ActiveAppSwitcher } from '@/components/admin/ActiveAppContext'

export function Shell() {
  const { active: isImpersonating } = useImpersonation()
  const location = useLocation()
  const showAdminNotice = location.pathname.startsWith('/admin')
  const showActiveAppSwitcher = showAdminNotice || (!location.pathname.startsWith('/operator') && !location.pathname.startsWith('/member'))

  return (
    <ActiveAppProvider>
      <div className={`flex h-screen overflow-hidden bg-background ${isImpersonating ? 'pt-10' : ''}`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 lg:p-8">
            {showAdminNotice ? (
              <ActiveAppNotice className="mb-6" />
            ) : showActiveAppSwitcher ? (
              <div className="mb-6 flex justify-end">
                <ActiveAppSwitcher mode="pill" size="sm" />
              </div>
            ) : null}
            <Outlet />
          </div>
        </main>
      </div>
    </ActiveAppProvider>
  )
}
