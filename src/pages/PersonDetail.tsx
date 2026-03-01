import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { EditableField } from '@/components/shared/EditableField'
import { CustomFieldsRenderer } from '@/components/shared/CustomFieldsRenderer'
import { EntityLinksPanel } from '@/components/shared/EntityLinksPanel'
import { ThreadPanel } from '@/components/shared/ThreadPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Mail,
  KanbanSquare,
  Activity as ActivityIcon,
  Building2,
  ArrowLeft,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react'

const PERSON_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

export function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const { currentAccountId, currentAccountNodeId } = useAuth()
  const isNew = personId === 'new'

  const [person, setPerson] = useState<any>(null)
  const [workflowItems, setWorkflowItems] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [memberships, setMemberships] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(isNew)
  const [saving, setSaving] = useState(false)

  // Draft fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [personStatus, setPersonStatus] = useState('active')
  const [metadata, setMetadata] = useState<Record<string, any>>({})

  useEffect(() => {
    if (isNew || !personId || !currentAccountId) return
    const pid = personId
    let cancelled = false

    setLoading(true)
    setErrorMessage(null)

    async function loadData() {
      try {
        const [personRes, itemsRes, activityRes, membershipsRes, accountsRes] =
          await Promise.all([
            apiGet<any>('persons', { id: pid }),
            apiGet<any[]>('workflow-items'),
            apiGet<any[]>('activity-events', { limit: '20' }),
            apiGet<any[]>('memberships'),
            apiGet<any[]>('accounts'),
          ])
        if (cancelled) return

        setAccounts(accountsRes || [])
        setPerson(personRes)
        setFullName(personRes.full_name || '')
        setEmail(personRes.email || '')
        setPersonStatus(personRes.status || 'active')
        setMetadata(personRes.metadata || {})

        setWorkflowItems(
          (itemsRes || []).filter(
            (i: any) => i.owner_person_id === pid,
          ),
        )

        setActivity(
          (activityRes || []).filter(
            (e: any) => e.person_id === pid,
          ),
        )

        const personMemberships = (membershipsRes || []).filter(
          (m: any) => m.person_id === pid,
        )
        setMemberships(personMemberships)
      } catch (err: any) {
        if (cancelled) return
        console.error('Failed to load person detail', err)
        setErrorMessage(err?.message || 'Failed to load person data')
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [personId, currentAccountId, currentAccountNodeId, isNew])

  function resetDraft() {
    if (person) {
      setFullName(person.full_name || '')
      setEmail(person.email || '')
      setPersonStatus(person.status || 'active')
      setMetadata(person.metadata || {})
    }
    setEditing(false)
  }

  async function handleSave() {
    if (!fullName.trim() || !email.trim()) {
      setErrorMessage('Full name and email are required.')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      if (isNew) {
        const created = await apiPost<any>('persons', {
          full_name: fullName,
          email,
        })
        navigate(`/persons/${created.id}`, { replace: true })
      } else {
        const updated = await apiPatch<any>('persons', {
          full_name: fullName,
          email,
          status: personStatus,
          metadata,
        }, { id: personId! })
        setPerson(updated)
        setEditing(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!personId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Person ID is missing.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/persons')}>
          ← Back to People
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Person' : 'Person Detail'}
          </h1>
        </div>
        {!isNew && !editing && !loading && person && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />Edit
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading person...</CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/persons')}>
              Go back
            </Button>
          </CardContent>
        </Card>
      ) : (person || isNew) ? (
        <>
          {/* Person header card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  {editing ? (
                    <span className="text-lg font-semibold">{fullName || 'New Person'}</span>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">{person.full_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{person.email}</span>
                        <Badge variant={person.status === 'active' ? 'default' : 'secondary'}>{person.status}</Badge>
                      </div>
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <EditableField label="Full Name" value={fullName} editing={editing} onChange={setFullName} required placeholder="Full name" />
                <EditableField label="Email" value={email} editing={editing} onChange={setEmail} required placeholder="email@example.com" />
                {!isNew && (
                  <EditableField label="Status" value={personStatus} editing={editing} onChange={setPersonStatus} type="select" options={PERSON_STATUSES} />
                )}
                {!isNew && !editing && (
                  <>
                    <EditableField label="Person ID" value={person.id} editing={false} mono />
                    <EditableField label="Display Name" value={person.profile?.display_name || person.full_name} editing={false} />
                    {person.profile?.system_role && (
                      <EditableField label="System Role" value={person.profile.system_role} editing={false} />
                    )}
                    <EditableField label="Account Role" value={memberships.length > 0 ? memberships[0].account_role : '—'} editing={false} />
                  </>
                )}
              </div>

              {/* Stats row */}
              {!isNew && !editing && (
                <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{workflowItems.length}</p>
                    <p className="text-xs text-muted-foreground">Workflow Items</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{activity.length}</p>
                    <p className="text-xs text-muted-foreground">Activities</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!isNew && (
            <CustomFieldsRenderer
              entityType="person"
              metadata={metadata}
              editing={editing}
              onChange={setMetadata}
            />
          )}

          {!isNew && !editing && personId && personId !== 'new' && (
            <EntityLinksPanel entityType="person" entityId={personId} />
          )}

          {!isNew && !editing && personId && personId !== 'new' && (
            <ThreadPanel targetType="person" targetId={personId} />
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
            {/* Account Memberships */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-4 w-4" />
                  Account Memberships
                </CardTitle>
                {!isNew && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!personId || personId === 'new') return
                      try {
                        await apiPost('memberships', { person_id: personId, account_role: 'member' })
                        const fresh = await apiGet<any[]>('memberships')
                        setMemberships((fresh || []).filter((m: any) => m.person_id === personId))
                      } catch (err: any) {
                        setErrorMessage(err?.message || 'Failed to add membership')
                      }
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add to Account
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {memberships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not a member of any account.</p>
                ) : (
                  memberships.map((m: any) => {
                    const acct = accounts.find((a: any) => a.id === m.account_id)
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() => navigate(`/accounts/${m.account_id}`)}
                      >
                        <div>
                          <p className="text-sm font-medium">{acct?.display_name || m.account_id}</p>
                          <p className="text-xs text-muted-foreground">Role: {m.account_role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{m.status}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await apiDelete('memberships', { id: m.id })
                                setMemberships((prev) => prev.filter((x: any) => x.id !== m.id))
                              } catch (err: any) {
                                setErrorMessage(err?.message || 'Failed to remove')
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* Workflow items owned by this person */}
            <SectionCard
              title="Workflow Items"
              icon={<KanbanSquare className="h-4 w-4" />}
              empty="No workflow items owned by this person."
              rows={workflowItems.slice(0, 5).map((item: any) => ({
                id: item.id,
                primary: item.title,
                secondary: `${item.workflow_definitions?.name || 'Workflow'} • ${item.stage_definitions?.name || 'Stage'}`,
                badges: [item.priority],
              }))}
              onRowClick={(id) => navigate(`/workflow-items/${id}`)}
              onViewAll={() => navigate('/workflows')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Activity */}
            <SectionCard
              title="Recent Activity"
              icon={<ActivityIcon className="h-4 w-4" />}
              empty="No recent activity."
              rows={activity.slice(0, 10).map((e: any) => ({
                id: e.id,
                primary: e.summary,
                secondary: new Date(e.created_at).toLocaleString(),
                badges: [e.event_type],
              }))}
              onViewAll={() => navigate('/activity')}
            />
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Person not found.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/persons')}>
              Go back
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reusable section card (same pattern as AccountDetail EntityCard)    */
/* ------------------------------------------------------------------ */
interface SectionCardProps {
  title: string
  icon: ReactNode
  empty: string
  rows: { id: string; primary: string; secondary?: string; badges?: (string | undefined)[] }[]
  onViewAll?: () => void
  onRowClick?: (id: string) => void
}

function SectionCard({ title, icon, empty, rows, onViewAll, onRowClick }: SectionCardProps) {
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
