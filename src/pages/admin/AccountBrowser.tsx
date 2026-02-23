import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useImpersonation } from '@/hooks/useImpersonation'
import { apiGet } from '@/lib/api'
import { Building2, Users, ShieldCheck, UserCog, ChevronRight, Play, Search, ArrowLeft } from 'lucide-react'

interface Account {
  id: string
  display_name: string
  account_type: string
  status: string
  slug: string | null
}

interface Member {
  id: string
  person_id: string
  account_role: string
  status: string
  persons: {
    id: string
    full_name: string
    email: string
  }
}

export function AccountBrowserPage() {
  const { profile } = useAuth()
  const { startImpersonation, active: isImpersonating } = useImpersonation()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [actingAs, setActingAs] = useState<string | null>(null)

  const isAdmin = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'

  useEffect(() => {
    apiGet<Account[]>('accounts')
      .then(a => setAccounts(a))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const loadMembers = useCallback(async (account: Account) => {
    setSelectedAccount(account)
    setMembersLoading(true)
    try {
      const data = await apiGet<Member[]>('memberships', { account_id: account.id })
      setMembers(data)
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [])

  const handleActAs = useCallback(async (member: Member) => {
    if (!selectedAccount || actingAs) return
    setActingAs(member.person_id)
    try {
      await startImpersonation(member.person_id, selectedAccount.id, reason || undefined)
      // Navigation will happen automatically as the app re-renders with new context
    } catch (err: any) {
      alert(`Failed to start impersonation: ${err.message}`)
      setActingAs(null)
    }
  }, [selectedAccount, reason, startImpersonation, actingAs])

  const filteredAccounts = accounts.filter(a =>
    a.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.slug && a.slug.toLowerCase().includes(search.toLowerCase()))
  )

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <ShieldCheck className="h-4 w-4 text-red-500" />
      case 'operator': return <UserCog className="h-4 w-4 text-amber-500" />
      default: return <Users className="h-4 w-4 text-muted-foreground" />
    }
  }

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'operator': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'portal': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  if (!isAdmin) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10" />
        <p className="text-lg font-medium">System Admin Access Required</p>
        <p className="text-sm">Only system admins can browse accounts and impersonate users.</p>
      </div>
    )
  }

  if (isImpersonating) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <UserCog className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <p className="text-lg font-medium">Currently Impersonating</p>
        <p className="text-sm">Exit the current impersonation session to browse accounts.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Browser</h1>
        <p className="text-sm text-muted-foreground">
          Browse all accounts and act as any member to troubleshoot or assist.
        </p>
      </div>

      {/* Reason field */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Reason:</label>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Customer requested assistance with workflow setup"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      {selectedAccount ? (
        /* ── Members view ── */
        <div className="space-y-4">
          <button
            onClick={() => { setSelectedAccount(null); setMembers([]) }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to accounts
          </button>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">{selectedAccount.display_name}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedAccount.slug} &middot; {selectedAccount.account_type} &middot; {selectedAccount.status}
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Members ({members.length})
          </h3>

          {membersLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No members found</div>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    {roleIcon(m.account_role)}
                    <div>
                      <div className="text-sm font-medium">{m.persons?.full_name ?? 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{m.persons?.email}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColor(m.account_role)}`}>
                      {m.account_role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleActAs(m)}
                    disabled={actingAs === m.person_id}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    {actingAs === m.person_id ? 'Starting...' : 'Act As'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Accounts list ── */
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts..."
              className="w-full rounded-md border bg-background pl-10 pr-3 py-2 text-sm"
            />
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading accounts...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No accounts found</div>
          ) : (
            <div className="space-y-2">
              {filteredAccounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => loadMembers(account)}
                  className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{account.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {account.slug || 'no slug'} &middot; {account.account_type}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
