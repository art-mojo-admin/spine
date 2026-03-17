import { useImpersonation } from '@/hooks/useImpersonation'
import { ShieldAlert, X } from 'lucide-react'

export function ImpersonationBanner() {
  const { active, session, stopImpersonation } = useImpersonation()

  if (!active || !session) return null

  const targetName = session.target_person?.full_name ?? 'Unknown User'
  const targetAccount = session.target_account?.display_name ?? 'Unknown Account'
  const expiresAt = new Date(session.expires_at)
  const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000))

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Acting as <strong>{targetName}</strong> ({session.target_account_role}) in{' '}
          <strong>{targetAccount}</strong>
          {session.reason && <span className="ml-1 opacity-75">— {session.reason}</span>}
          <span className="ml-2 rounded bg-amber-600/20 px-1.5 py-0.5 text-xs">
            {minutesLeft}m remaining
          </span>
        </span>
      </div>
      <button
        onClick={stopImpersonation}
        className="flex items-center gap-1 rounded bg-amber-950/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-amber-950/40"
      >
        <X className="h-3 w-3" />
        Exit
      </button>
    </div>
  )
}
