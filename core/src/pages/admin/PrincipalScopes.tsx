import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { UserCheck, Info } from 'lucide-react'

interface ScopeOption {
  id: string
  slug: string
  label: string
  status?: string
}

interface AccountScopeRecord {
  id: string
  scope_id: string
  status: 'enabled' | 'disabled' | 'preview'
  auth_scopes?: ScopeOption & { description?: string | null }
}

interface MembershipRecord {
  id: string
  person_id: string
  account_role: string
  status: string
  persons?: {
    id: string
    full_name: string | null
    email: string | null
  }
}

interface MachinePrincipalRecord {
  id: string
  name: string
  status: 'active' | 'suspended' | 'revoked'
}

interface PrincipalScopeRecord {
  id: string
  scope_id: string
  principal_type: 'human' | 'machine' | 'system'
  assignment_type: 'direct' | 'role_bundle' | 'justification' | 'system_default'
  notes: string | null
  granted_reason: string | null
  expires_at: string | null
  auth_scopes?: ScopeOption
  persons?: { id: string; full_name: string | null; email: string | null }
  machine_principals?: { id: string; name: string | null; status: string }
}

type PrincipalFilter = 'all' | 'human' | 'machine' | 'system'

const ASSIGNMENT_TYPES: PrincipalScopeRecord['assignment_type'][] = ['direct', 'role_bundle', 'justification', 'system_default']

export function PrincipalScopesPage() {
  const [accountScopes, setAccountScopes] = useState<AccountScopeRecord[]>([])
  const [members, setMembers] = useState<MembershipRecord[]>([])
  const [machines, setMachines] = useState<MachinePrincipalRecord[]>([])
  const [assignments, setAssignments] = useState<PrincipalScopeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PrincipalFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    principal_type: 'human' as PrincipalScopeRecord['principal_type'],
    person_id: '',
    machine_principal_id: '',
    scope_id: '',
    assignment_type: 'direct' as PrincipalScopeRecord['assignment_type'],
    notes: '',
    granted_reason: '',
    expires_at: '',
  })
  const [editing, setEditing] = useState<Record<string, { notes: string; granted_reason: string; expires_at: string }>>({})

  useEffect(() => {
    loadInitial()
  }, [])

  async function loadInitial() {
    setLoading(true)
    try {
      const [scopeData, memberData, machineData, assignmentData] = await Promise.all([
        apiGet<AccountScopeRecord[]>('account-scopes'),
        apiGet<MembershipRecord[]>('memberships'),
        apiGet<MachinePrincipalRecord[]>('machine-principals'),
        apiGet<PrincipalScopeRecord[]>('principal-scopes'),
      ])
      setAccountScopes(scopeData || [])
      setMembers((memberData || []).filter(m => m.status === 'active'))
      setMachines(machineData || [])
      setAssignments(assignmentData || [])
      setEditing({})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const availableScopes = useMemo(
    () => accountScopes.filter(scope => scope.status !== 'disabled'),
    [accountScopes],
  )

  const filteredAssignments = useMemo(() => {
    if (filter === 'all') return assignments
    return assignments.filter(a => a.principal_type === filter)
  }, [assignments, filter])

  const sortedAssignments = useMemo(
    () => filteredAssignments.slice().sort((a, b) => {
      const left = `${a.principal_type}-${a.auth_scopes?.label || a.scope_id}`
      const right = `${b.principal_type}-${b.auth_scopes?.label || b.scope_id}`
      return left.localeCompare(right)
    }),
    [filteredAssignments],
  )

  function updateForm(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function getPrincipalLabel(record: PrincipalScopeRecord) {
    if (record.principal_type === 'human') {
      return record.persons?.full_name || record.persons?.email || record.persons?.id || 'Member'
    }
    if (record.principal_type === 'machine') {
      return record.machine_principals?.name || record.machine_principals?.id || 'Machine Principal'
    }
    return 'System Principal'
  }

  function getEditBuffer(record: PrincipalScopeRecord) {
    if (!editing[record.id]) {
      setEditing(prev => ({
        ...prev,
        [record.id]: {
          notes: record.notes || '',
          granted_reason: record.granted_reason || '',
          expires_at: record.expires_at || '',
        },
      }))
    }
    return editing[record.id] || { notes: record.notes || '', granted_reason: record.granted_reason || '', expires_at: record.expires_at || '' }
  }

  function updateBuffer(id: string, field: 'notes' | 'granted_reason' | 'expires_at', value: string) {
    setEditing(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { notes: '', granted_reason: '', expires_at: '' }),
        [field]: value,
      },
    }))
  }

  async function handleCreate() {
    if (!form.scope_id) {
      alert('Select a scope to grant')
      return
    }
    if (form.principal_type === 'human' && !form.person_id) {
      alert('Select a member')
      return
    }
    if (form.principal_type === 'machine' && !form.machine_principal_id) {
      alert('Select a machine principal')
      return
    }
    try {
      await apiPost('principal-scopes', {
        principal_type: form.principal_type,
        person_id: form.principal_type === 'human' ? form.person_id : undefined,
        machine_principal_id: form.principal_type === 'machine' ? form.machine_principal_id : undefined,
        scope_id: form.scope_id,
        assignment_type: form.assignment_type,
        notes: form.notes || null,
        granted_reason: form.granted_reason || null,
        expires_at: form.expires_at || null,
      })
      setShowForm(false)
      setForm({ principal_type: 'human', person_id: '', machine_principal_id: '', scope_id: '', assignment_type: 'direct', notes: '', granted_reason: '', expires_at: '' })
      await loadInitial()
    } catch (err: any) {
      alert(err?.message || 'Failed to grant scope')
    }
  }

  async function handleSave(record: PrincipalScopeRecord) {
    try {
      const buffer = getEditBuffer(record)
      await apiPatch(
        'principal-scopes',
        {
          notes: buffer.notes || null,
          granted_reason: buffer.granted_reason || null,
          expires_at: buffer.expires_at || null,
          assignment_type: record.assignment_type,
        },
        { id: record.id },
      )
      await loadInitial()
    } catch (err: any) {
      alert(err?.message || 'Failed to update scope assignment')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Revoke this scope?')) return
    try {
      await apiDelete('principal-scopes', { id })
      await loadInitial()
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke scope')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Principal Scopes</h1>
          <p className="text-muted-foreground">Grant or revoke granular capabilities for humans, machines, or system actors.</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="principal-scopes">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span className="font-medium">Understanding Principal Scopes</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold">Purpose</h4>
                <p className="text-muted-foreground">Principal scopes grant specific capabilities to individual users, machine principals, or system actors, providing fine-grained access control beyond account-level scopes.</p>
              </div>
              <div>
                <h4 className="font-semibold">Configuration</h4>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><strong>Principal Type:</strong> Human (users), Machine (automations), or System (internal processes)</li>
                  <li><strong>Assignment Type:</strong> Direct (explicit), Role Bundle (from role), Justification (temporary), or System Default</li>
                  <li><strong>Expiration:</strong> Optional expiration date for temporary access</li>
                  <li><strong>Reason:</strong> Documentation for why this scope was granted</li>
                  <li><strong>Notes:</strong> Additional context about the scope assignment</li>
                </ul>
                <p className="text-muted-foreground mt-2">Use principal scopes when specific users or services need access beyond what their role or account provides.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value as PrincipalFilter)}
          >
            <option value="all">All principals</option>
            <option value="human">Humans</option>
            <option value="machine">Machine</option>
            <option value="system">System</option>
          </select>
          <Button size="sm" onClick={() => setShowForm(prev => !prev)}>
            {showForm ? 'Close' : 'Grant Scope'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Grant Scope</CardTitle>
            <CardDescription>Assignments are logged and enforced immediately across apps and APIs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Principal Type</label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.principal_type}
                  onChange={e => updateForm('principal_type', e.target.value)}
                >
                  <option value="human">Human</option>
                  <option value="machine">Machine</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Scope</label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.scope_id}
                  onChange={e => updateForm('scope_id', e.target.value)}
                >
                  <option value="">Select scope…</option>
                  {availableScopes.map(scope => (
                    <option key={scope.id} value={scope.scope_id || scope.id}>
                      {scope.auth_scopes?.label || scope.auth_scopes?.slug || scope.scope_id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.principal_type === 'human' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Member</label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.person_id}
                  onChange={e => updateForm('person_id', e.target.value)}
                >
                  <option value="">Select member…</option>
                  {members.map(member => (
                    <option key={member.person_id} value={member.person_id}>
                      {member.persons?.full_name || member.persons?.email || member.person_id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.principal_type === 'machine' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Machine Principal</label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.machine_principal_id}
                  onChange={e => updateForm('machine_principal_id', e.target.value)}
                >
                  <option value="">Select machine principal…</option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignment Type</label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.assignment_type}
                  onChange={e => updateForm('assignment_type', e.target.value)}
                >
                  {ASSIGNMENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Expires At</label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={e => updateForm('expires_at', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Input
                placeholder="Why is this scope required?"
                value={form.granted_reason}
                onChange={e => updateForm('granted_reason', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.notes}
                onChange={e => updateForm('notes', e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate}>Grant Scope</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading assignments…</CardContent>
        </Card>
      ) : sortedAssignments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">No principal scopes found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedAssignments.map(record => {
            const buffer = getEditBuffer(record)
            return (
              <Card key={record.id}>
                <CardHeader>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">{getPrincipalLabel(record)}</CardTitle>
                      <CardDescription>
                        {record.auth_scopes?.label || record.auth_scopes?.slug || record.scope_id}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="uppercase">
                      {record.principal_type}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Assignment: {record.assignment_type}</span>
                    {record.expires_at && <span>Expires {new Date(record.expires_at).toLocaleString()}</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes</label>
                      <textarea
                        className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={buffer.notes}
                        onChange={e => updateBuffer(record.id, 'notes', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason</label>
                      <Input
                        value={buffer.granted_reason}
                        onChange={e => updateBuffer(record.id, 'granted_reason', e.target.value)}
                      />
                      <label className="text-sm font-medium">Expires At</label>
                      <Input
                        type="datetime-local"
                        value={buffer.expires_at}
                        onChange={e => updateBuffer(record.id, 'expires_at', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleSave(record)}>
                      Save Changes
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(record.id)}>
                      Revoke
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
