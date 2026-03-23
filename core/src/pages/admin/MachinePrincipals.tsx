import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Bot, Info } from 'lucide-react'

interface MachinePrincipal {
  id: string
  name: string
  description: string | null
  status: 'active' | 'suspended' | 'revoked'
  kind: 'automation' | 'api_key' | 'ai_agent' | 'integration'
  auth_mode: 'api_key' | 'signed_jwt' | 'oauth_client'
  visibility: 'private' | 'shared'
  audit_channel: string | null
  metadata: Record<string, unknown>
  ownership: 'pack' | 'tenant'
  created_at: string
  updated_at: string
}

type StatusFilter = 'all' | MachinePrincipal['status']

const KIND_OPTIONS: MachinePrincipal['kind'][] = ['automation', 'api_key', 'ai_agent', 'integration']
const AUTH_MODES: MachinePrincipal['auth_mode'][] = ['api_key', 'signed_jwt', 'oauth_client']
const VISIBILITY_OPTIONS: MachinePrincipal['visibility'][] = ['private', 'shared']
const STATUS_BADGE: Record<MachinePrincipal['status'], { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  suspended: { variant: 'secondary', label: 'Suspended' },
  revoked: { variant: 'destructive', label: 'Revoked' },
}

export function MachinePrincipalsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [principals, setPrincipals] = useState<MachinePrincipal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    kind: 'automation' as MachinePrincipal['kind'],
    auth_mode: 'api_key' as MachinePrincipal['auth_mode'],
    visibility: 'private' as MachinePrincipal['visibility'],
    audit_channel: '',
    metadata: '{}',
  })
  const [editing, setEditing] = useState<Record<string, { description: string; audit_channel: string; metadata: string }>>({})

  useEffect(() => {
    loadData()
  }, [statusFilter])

  async function loadData() {
    setLoading(true)
    try {
      const params = statusFilter === 'all' ? undefined : { status: statusFilter }
      const data = await apiGet<MachinePrincipal[]>('machine-principals', params)
      setPrincipals(data || [])
      setEditing({})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sortedPrincipals = useMemo(
    () => principals.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [principals],
  )

  function updateForm(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function getEditBuffer(record: MachinePrincipal) {
    if (!editing[record.id]) {
      setEditing(prev => ({
        ...prev,
        [record.id]: {
          description: record.description || '',
          audit_channel: record.audit_channel || '',
          metadata: JSON.stringify(record.metadata || {}, null, 2),
        },
      }))
    }
    return (
      editing[record.id] || {
        description: record.description || '',
        audit_channel: record.audit_channel || '',
        metadata: JSON.stringify(record.metadata || {}, null, 2),
      }
    )
  }

  function updateBuffer(id: string, field: 'description' | 'audit_channel' | 'metadata', value: string) {
    setEditing(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { description: '', audit_channel: '', metadata: '{}' }),
        [field]: value,
      },
    }))
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      alert('Name is required')
      return
    }
    try {
      const metadata = form.metadata.trim() ? JSON.parse(form.metadata) : {}
      await apiPost('machine-principals', {
        name: form.name.trim(),
        description: form.description || null,
        kind: form.kind,
        auth_mode: form.auth_mode,
        visibility: form.visibility,
        audit_channel: form.audit_channel || null,
        metadata,
      })
      setShowForm(false)
      setForm({ name: '', description: '', kind: 'automation', auth_mode: 'api_key', visibility: 'private', audit_channel: '', metadata: '{}' })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to create machine principal')
    }
  }

  async function handleStatusChange(record: MachinePrincipal, status: MachinePrincipal['status']) {
    if (status === record.status) return
    try {
      await apiPatch('machine-principals', { status }, { id: record.id })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to update status')
    }
  }

  async function handleSave(record: MachinePrincipal) {
    try {
      const buffer = getEditBuffer(record)
      const metadata = buffer.metadata.trim() ? JSON.parse(buffer.metadata) : {}
      await apiPatch(
        'machine-principals',
        {
          description: buffer.description || null,
          audit_channel: buffer.audit_channel || null,
          metadata,
        },
        { id: record.id },
      )
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to update machine principal')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this machine principal? Any scope assignments must be cleared first.')) return
    try {
      await apiDelete('machine-principals', { id })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete machine principal')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Machine Principals</h1>
          <p className="text-muted-foreground">Manage automation identities, API keys, and shared service accounts.</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="machine-principals">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span className="font-medium">Understanding Machine Principals</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold">Purpose</h4>
                <p className="text-muted-foreground">Machine principals are non-human identities used by automations, integrations, and services to authenticate and interact with the system programmatically.</p>
              </div>
              <div>
                <h4 className="font-semibold">Configuration</h4>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><strong>Kind:</strong> Choose between automation, api_key, ai_agent, or integration</li>
                  <li><strong>Auth Mode:</strong> API key, signed JWT, or OAuth client credentials</li>
                  <li><strong>Visibility:</strong> Private (tenant-only) or shared (cross-tenant)</li>
                  <li><strong>Status:</strong> Active, suspended, or revoked for lifecycle management</li>
                  <li><strong>Audit Channel:</strong> Optional webhook/slack channel for activity logging</li>
                </ul>
                <p className="text-muted-foreground mt-2">Assign scopes to principals through Principal Scopes page to control their API access.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="revoked">Revoked</option>
          </select>
          <Button size="sm" onClick={() => setShowForm(prev => !prev)}>
            {showForm ? 'Close' : 'New Principal'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Machine Principal</CardTitle>
            <CardDescription>Provision automation identities with scoped capabilities and audit channels.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Inbound Sync Bot" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Kind</label>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={form.kind}
                onChange={e => updateForm('kind', e.target.value)}
              >
                {KIND_OPTIONS.map(kind => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Auth Mode</label>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={form.auth_mode}
                onChange={e => updateForm('auth_mode', e.target.value)}
              >
                {AUTH_MODES.map(mode => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibility</label>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={form.visibility}
                onChange={e => updateForm('visibility', e.target.value)}
              >
                {VISIBILITY_OPTIONS.map(vis => (
                  <option key={vis} value={vis}>
                    {vis}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Audit Channel</label>
              <Input
                placeholder="#automation-log"
                value={form.audit_channel}
                onChange={e => updateForm('audit_channel', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Metadata JSON</label>
              <textarea
                className="min-h-[120px] w-full font-mono text-xs rounded-md border bg-background px-3 py-2"
                value={form.metadata}
                onChange={e => updateForm('metadata', e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={handleCreate}>Create Principal</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading machine principals…</CardContent>
        </Card>
      ) : sortedPrincipals.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No machine principals found. Create one to issue API keys or automation identities.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedPrincipals.map(principal => {
            const buffer = getEditBuffer(principal)
            const statusMeta = STATUS_BADGE[principal.status]
            return (
              <Card key={principal.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{principal.name}</CardTitle>
                      <CardDescription>{principal.id}</CardDescription>
                    </div>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase">{principal.kind}</span>
                    <span>Auth: {principal.auth_mode}</span>
                    <span>Visibility: {principal.visibility}</span>
                    <span>Ownership: {principal.ownership}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(['active', 'suspended', 'revoked'] as MachinePrincipal['status'][]).map(status => (
                      <Button
                        key={status}
                        size="sm"
                        variant={principal.status === status ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(principal, status)}
                      >
                        {STATUS_BADGE[status].label}
                      </Button>
                    ))}
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleSave(principal)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(principal.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={buffer.description}
                      onChange={e => updateBuffer(principal.id, 'description', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audit Channel</label>
                    <Input
                      value={buffer.audit_channel}
                      onChange={e => updateBuffer(principal.id, 'audit_channel', e.target.value)}
                      placeholder="#alerts"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Metadata JSON</label>
                    <textarea
                      className="min-h-[140px] w-full font-mono text-xs rounded-md border bg-background px-3 py-2"
                      value={buffer.metadata}
                      onChange={e => updateBuffer(principal.id, 'metadata', e.target.value)}
                    />
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
