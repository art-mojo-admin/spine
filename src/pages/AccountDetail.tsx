import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { EditableField } from '@/components/shared/EditableField'
import { CustomFieldsRenderer } from '@/components/shared/CustomFieldsRenderer'
import { EntityLinksPanel } from '@/components/shared/EntityLinksPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, GitBranch, KanbanSquare, Ticket, BookOpen, Activity as ActivityIcon, Pencil, Save, X, ArrowLeft } from 'lucide-react'

const ACCOUNT_TYPES = [
  { value: 'organization', label: 'Organization' },
  { value: 'personal', label: 'Personal' },
  { value: 'team', label: 'Team' },
]

const ACCOUNT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
]

interface AccountRecord {
  id: string
  display_name: string
  account_type: string
  status: string
  created_at: string
  metadata: Record<string, any>
}

export function AccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { currentAccountId, setCurrentAccountId } = useAuth()
  const isNew = accountId === 'new'

  const [account, setAccount] = useState<AccountRecord | null>(null)
  const [people, setPeople] = useState<any[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [workflowItems, setWorkflowItems] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [saving, setSaving] = useState(false)

  // Draft fields
  const [displayName, setDisplayName] = useState('')
  const [accountType, setAccountType] = useState('organization')
  const [accountStatus, setAccountStatus] = useState('active')
  const [metadata, setMetadata] = useState<Record<string, any>>({})

  useEffect(() => {
    if (isNew || !accountId) return
    if (accountId && currentAccountId !== accountId) {
      setCurrentAccountId(accountId)
    }
  }, [accountId, currentAccountId, setCurrentAccountId, isNew])

  useEffect(() => {
    if (isNew || !accountId || currentAccountId !== accountId) return
    const ensuredAccountId = accountId

    setLoading(true)
    setErrorMessage(null)

    async function loadData() {
      try {
        const [accountRes, personsRes, workflowsRes, itemsRes, ticketsRes, articlesRes, activityRes] = await Promise.all([
          apiGet<AccountRecord>('accounts', { id: ensuredAccountId }),
          apiGet<any[]>('persons'),
          apiGet<any[]>('workflow-definitions'),
          apiGet<any[]>('workflow-items'),
          apiGet<any[]>('tickets'),
          apiGet<any[]>('kb-articles'),
          apiGet<any[]>('activity-events', { limit: '10' }),
        ])
        setAccount(accountRes)
        setDisplayName(accountRes.display_name || '')
        setAccountType(accountRes.account_type || 'organization')
        setAccountStatus(accountRes.status || 'active')
        setMetadata(accountRes.metadata || {})
        setPeople(personsRes)
        setWorkflows(workflowsRes)
        setWorkflowItems(itemsRes)
        setTickets(ticketsRes)
        setArticles(articlesRes)
        setActivity(activityRes)
      } catch (err: any) {
        console.error('Failed to load account detail', err)
        setErrorMessage(err?.message || 'Failed to load account data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [accountId, currentAccountId, isNew])

  function resetDraft() {
    if (account) {
      setDisplayName(account.display_name || '')
      setAccountType(account.account_type || 'organization')
      setAccountStatus(account.status || 'active')
      setMetadata(account.metadata || {})
    }
    setEditing(false)
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setErrorMessage('Display name is required.')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      if (isNew) {
        const created = await apiPost<AccountRecord>('accounts', {
          display_name: displayName,
          account_type: accountType,
        })
        setCurrentAccountId(created.id)
        navigate(`/accounts/${created.id}`, { replace: true })
      } else {
        const updated = await apiPatch<AccountRecord>('accounts', {
          display_name: displayName,
          status: accountStatus,
          metadata,
        }, { id: accountId! })
        setAccount(updated)
        setEditing(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const workflowItemsByDefinition = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of workflowItems) {
      const defName = item.workflow_definitions?.name || 'Workflow'
      map.set(defName, (map.get(defName) || 0) + 1)
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [workflowItems])

  if (!accountId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Account ID is missing.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/accounts')}>
          ← Back to Accounts
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/accounts')}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Account' : 'Account Detail'}
          </h1>
        </div>
        {!isNew && !editing && !loading && account && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />Edit
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading account...</CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/accounts')}>
              Go back
            </Button>
          </CardContent>
        </Card>
      ) : (account || isNew) ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  {editing ? (
                    <span className="text-lg font-semibold">{displayName || 'Untitled Account'}</span>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">{account!.display_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{account!.account_type}</span>
                        <Badge variant={account!.status === 'active' ? 'default' : 'secondary'}>{account!.status}</Badge>
                      </div>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <EditableField label="Display Name" value={displayName} editing={editing} onChange={setDisplayName} required placeholder="Account name" />
                <EditableField label="Account Type" value={accountType} editing={editing && isNew} onChange={setAccountType} type="select" options={ACCOUNT_TYPES} />
                {!isNew && (
                  <EditableField label="Status" value={accountStatus} editing={editing} onChange={setAccountStatus} type="select" options={ACCOUNT_STATUSES} />
                )}
                {!isNew && !editing && (
                  <>
                    <EditableField label="Account ID" value={account!.id} editing={false} mono />
                    <EditableField label="Created" value={new Date(account!.created_at).toLocaleString()} editing={false} />
                    <EditableField label="People" value={String(people.length)} editing={false} />
                    <EditableField label="Active Workflows" value={String(workflows.length)} editing={false} />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {!isNew && (
            <CustomFieldsRenderer
              entityType="account"
              metadata={metadata}
              editing={editing}
              onChange={setMetadata}
            />
          )}

          {!isNew && !editing && accountId && accountId !== 'new' && (
            <EntityLinksPanel entityType="account" entityId={accountId} />
          )}

          {editing && (
            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="mr-1 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
              </Button>
              {!isNew && (
                <Button variant="ghost" onClick={resetDraft}>
                  <X className="mr-1 h-4 w-4" />Cancel
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <EntityCard
              title="People"
              icon={<Users className="h-4 w-4" />}
              empty="No people associated with this account."
              rows={people.slice(0, 5).map((person) => ({
                id: person.id,
                primary: person.full_name,
                secondary: person.email,
                badges: [person.membership?.account_role, person.status],
              }))}
              onRowClick={(id) => navigate(`/persons/${id}`)}
              onViewAll={() => navigate('/persons')}
            />

            <EntityCard
              title="Workflows"
              icon={<GitBranch className="h-4 w-4" />}
              empty="No workflows defined."
              rows={workflows.map((wf: any) => ({
                id: wf.id,
                primary: wf.name,
                secondary: wf.description || 'No description',
                badges: [`${workflowItemsByDefinition.find((x) => x.name === wf.name)?.count || 0} items`, wf.status],
              }))}
              onRowClick={(id) => navigate(`/workflows?id=${id}`)}
              onViewAll={() => navigate('/workflows')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <EntityCard
              title="Deals & Workflow Items"
              icon={<KanbanSquare className="h-4 w-4" />}
              empty="No workflow items yet."
              rows={workflowItems.slice(0, 5).map((item: any) => ({
                id: item.id,
                primary: item.title,
                secondary: `${item.workflow_definitions?.name || 'Workflow'} • ${item.stage_definitions?.name || 'Stage'}`,
                meta: item.metadata?.company?.name,
                badges: [item.priority, item.persons?.full_name].filter(Boolean),
              }))}
              onRowClick={(id) => navigate(`/workflow-items/${id}`)}
              onViewAll={() => navigate('/workflows')}
            />

            <EntityCard
              title="Tickets"
              icon={<Ticket className="h-4 w-4" />}
              empty="No tickets open."
              rows={tickets.slice(0, 5).map((ticket: any) => ({
                id: ticket.id,
                primary: ticket.subject,
                secondary: `Opened ${new Date(ticket.created_at).toLocaleDateString()}`,
                badges: [ticket.priority, ticket.status],
              }))}
              onRowClick={(id) => navigate(`/tickets/${id}`)}
              onViewAll={() => navigate('/tickets')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <EntityCard
              title="Knowledge Base"
              icon={<BookOpen className="h-4 w-4" />}
              empty="No KB articles."
              rows={articles.slice(0, 5).map((a: any) => ({
                id: a.id,
                primary: a.title,
                secondary: a.category || 'Uncategorized',
                badges: [a.status, a.author?.full_name].filter(Boolean),
              }))}
              onRowClick={(id) => navigate(`/kb/${id}`)}
              onViewAll={() => navigate('/kb')}
            />

            <EntityCard
              title="Recent Activity"
              icon={<ActivityIcon className="h-4 w-4" />}
              empty="No recent activity."
              rows={activity.map((event: any) => ({
                id: event.id,
                primary: event.summary,
                secondary: new Date(event.created_at).toLocaleString(),
                badges: [event.event_type],
              }))}
              onViewAll={() => navigate('/activity')}
            />
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Account not found.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/accounts')}>
              Go back
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface EntityCardProps {
  title: string
  icon: ReactNode
  empty: string
  rows: { id: string; primary: string; secondary?: string; badges?: (string | undefined)[]; meta?: string }[]
  onViewAll?: () => void
  onRowClick?: (id: string) => void
}

function EntityCard({ title, icon, empty, rows, onViewAll, onRowClick }: EntityCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className={`rounded-md border p-3${onRowClick ? ' cursor-pointer transition-colors hover:bg-muted/50' : ''}`}
              onClick={onRowClick ? () => onRowClick(row.id) : undefined}
            >
              <p className="text-sm font-medium">{row.primary}</p>
              {row.secondary && <p className="text-xs text-muted-foreground">{row.secondary}</p>}
              {row.meta && <p className="text-xs text-muted-foreground mt-1">{row.meta}</p>}
              {row.badges && row.badges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.badges.filter(Boolean).map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
