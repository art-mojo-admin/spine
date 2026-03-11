import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface ScopeSummary {
  id: string
  slug: string
  label: string
  description: string | null
  category: string
  is_active: boolean
}

interface AccountScopeRecord {
  id: string
  scope_id: string
  status: 'enabled' | 'disabled' | 'preview'
  source: 'pack' | 'manual'
  ownership: 'pack' | 'tenant'
  notes: string | null
  config: Record<string, unknown>
  enabled_at: string | null
  disabled_at: string | null
  updated_at: string
  auth_scopes?: ScopeSummary & { default_role?: string | null }
}

type StatusOption = AccountScopeRecord['status']

const STATUS_BADGE: Record<StatusOption, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
  enabled: { variant: 'default', label: 'Enabled' },
  preview: { variant: 'secondary', label: 'Preview' },
  disabled: { variant: 'outline', label: 'Disabled' },
}

export function AccountScopesPage() {
  const [accountScopes, setAccountScopes] = useState<AccountScopeRecord[]>([])
  const [allScopes, setAllScopes] = useState<ScopeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newScopeSlug, setNewScopeSlug] = useState('')
  const [newScopeStatus, setNewScopeStatus] = useState<StatusOption>('enabled')
  const [newScopeNotes, setNewScopeNotes] = useState('')
  const [editing, setEditing] = useState<Record<string, { notes: string; config: string }>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [accountData, registry] = await Promise.all([
        apiGet<AccountScopeRecord[]>('account-scopes'),
        apiGet<ScopeSummary[]>('scopes', { include_capabilities: 'false', include_inactive: 'true' }),
      ])
      setAccountScopes(accountData || [])
      setAllScopes(registry || [])
      setEditing({})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const availableScopes = useMemo(() => {
    const activeScopes = allScopes.filter(scope => scope.is_active)
    const activeIds = new Set(accountScopes.map(scope => scope.scope_id))
    return activeScopes.filter(scope => !activeIds.has(scope.id))
  }, [accountScopes, allScopes])

  function getEditBuffer(record: AccountScopeRecord) {
    if (!editing[record.id]) {
      setEditing(prev => ({
        ...prev,
        [record.id]: {
          notes: record.notes || '',
          config: JSON.stringify(record.config || {}, null, 2),
        },
      }))
    }
    return editing[record.id] || { notes: record.notes || '', config: JSON.stringify(record.config || {}, null, 2) }
  }

  function updateBuffer(id: string, field: 'notes' | 'config', value: string) {
    setEditing(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { notes: '', config: '{}' }),
        [field]: value,
      },
    }))
  }

  async function handleStatusChange(record: AccountScopeRecord, status: StatusOption) {
    try {
      await apiPatch('account-scopes', { status }, { id: record.id })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to update status')
    }
  }

  async function handleSaveDetails(record: AccountScopeRecord) {
    try {
      const buffer = getEditBuffer(record)
      let parsedConfig: Record<string, unknown> = {}
      if (buffer.config.trim()) {
        parsedConfig = JSON.parse(buffer.config)
      }
      await apiPatch('account-scopes', { notes: buffer.notes || null, config: parsedConfig }, { id: record.id })
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to update scope')
    }
  }

  async function handleCreateScope() {
    if (!newScopeSlug) {
      alert('Select a scope to enable')
      return
    }
    try {
      await apiPost('account-scopes', {
        scope_slug: newScopeSlug,
        status: newScopeStatus,
        notes: newScopeNotes || null,
      })
      setShowCreate(false)
      setNewScopeSlug('')
      setNewScopeNotes('')
      setNewScopeStatus('enabled')
      await loadData()
    } catch (err: any) {
      alert(err?.message || 'Failed to enable scope')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Scopes</h1>
          <p className="text-muted-foreground">Enable or configure capability bundles for this tenant.</p>
        </div>
        <Button variant={showCreate ? 'ghost' : 'default'} onClick={() => setShowCreate(prev => !prev)}>
          {showCreate ? 'Close' : 'Enable Scope'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Enable a Scope</CardTitle>
            <CardDescription>Scopes control which packs, apps, and principals can activate features.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Scope</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={newScopeSlug}
                  onChange={e => setNewScopeSlug(e.target.value)}
                >
                  <option value="">Select a scope…</option>
                  {availableScopes.map(scope => (
                    <option key={scope.id} value={scope.slug}>
                      {scope.label} ({scope.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial status</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={newScopeStatus}
                  onChange={e => setNewScopeStatus(e.target.value as StatusOption)}
                >
                  <option value="enabled">Enabled</option>
                  <option value="preview">Preview</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Notes <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newScopeNotes}
                onChange={e => setNewScopeNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateScope} disabled={!newScopeSlug}>
                Enable Scope
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Loading scopes…</CardContent>
        </Card>
      ) : accountScopes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No scopes configured for this account yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accountScopes.map(record => {
            const buffer = getEditBuffer(record)
            const statusMeta = STATUS_BADGE[record.status]
            const scope = record.auth_scopes
            return (
              <Card key={record.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">
                        {scope?.label || record.scope_id}
                      </CardTitle>
                      <CardDescription>{scope?.slug}</CardDescription>
                    </div>
                    <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium uppercase">{scope?.category || 'unknown'}</span>
                    <span>Source: {record.source}</span>
                    <span>Ownership: {record.ownership}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  {scope?.description && (
                    <p className="text-sm text-muted-foreground">{scope.description}</p>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {(['enabled', 'preview', 'disabled'] as StatusOption[]).map(option => (
                        <Button
                          key={option}
                          size="sm"
                          variant={record.status === option ? 'default' : 'outline'}
                          onClick={() => handleStatusChange(record, option)}
                        >
                          {STATUS_BADGE[option].label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={buffer.notes}
                      onChange={e => updateBuffer(record.id, 'notes', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Config JSON</label>
                    <textarea
                      className="min-h-[140px] w-full font-mono text-xs rounded-md border bg-background px-3 py-2"
                      value={buffer.config}
                      onChange={e => updateBuffer(record.id, 'config', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Configure pack-specific overrides or tenant settings for this scope.
                    </p>
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Button size="sm" onClick={() => handleSaveDetails(record)}>
                      Save Changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(prev => ({ ...prev, [record.id]: undefined as never }))}>
                      Reset
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
