import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useImpersonation } from '@/hooks/useImpersonation'

export function Shell() {
  const { active: isImpersonating } = useImpersonation()

  return (
    <div className={`flex h-screen overflow-hidden bg-background ${isImpersonating ? 'pt-10' : ''}`}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
