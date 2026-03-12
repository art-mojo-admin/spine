import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SelectNative } from '@/components/ui/select-native'
import { ChevronDown, ChevronRight, Shield, ShieldQuestion } from 'lucide-react'

interface PackSummary {
  id: string
  name: string
  slug: string | null
  icon: string | null
  category: string | null
}

interface EntitySummary {
  id: string
  type: string
  label: string
  slug: string | null
  icon: string | null
  status: string | null
  attributes: Record<string, unknown>
}

interface FieldPolicy {
  id: string
  field_path: string
  visibility: Record<string, unknown>
  editability: Record<string, unknown>
  metadata: Record<string, unknown>
}

interface RolePolicy {
  id: string
  entity_type: string
  entity_id: string
  ownership: 'pack' | 'tenant'
  account_id: string | null
  pack_id: string | null
  template_entity_id: string | null
  visibility: Record<string, unknown>
  editability: Record<string, unknown>
  metadata: Record<string, unknown>
  pack: PackSummary | null
  entity: EntitySummary | null
  template_entity: EntitySummary | null
  fields: FieldPolicy[]
}

interface RoleMatrixResponse {
  account_id: string | null
  pack_id: string | null
  state: 'all' | 'account' | 'template'
  total: number
  totals_by_entity: Record<string, number>
  policies: RolePolicy[]
}

interface PolicyMutationPayload {
  action: 'upsert_policy'
  entity_type: string
  entity_id: string
  account_id?: string | null
  pack_id?: string | null
  ownership?: 'pack' | 'tenant'
  template_entity_id?: string | null
  visibility?: Record<string, unknown>
  editability?: Record<string, unknown>
  metadata?: Record<string, unknown>
  fields?: Array<{ field_path: string; visibility?: Record<string, unknown>; editability?: Record<string, unknown>; metadata?: Record<string, unknown> }>
  version_tag?: string | null
  version_note?: string | null
}

interface InspectorState {
  policy: RolePolicy
  visibilityDraft: string
  editabilityDraft: string
  fieldsDraft: string
  versionTag: string
  versionNote: string
  saving: boolean
  savingMessage: string | null
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function tryParseJson(value: string): Record<string, unknown> {
  if (!value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') return parsed
    return {}
  } catch {
    return {}
  }
}

function resolveDefaultRole(value: Record<string, unknown> | null | undefined) {
  const defaultRole = value?.['default_role']
  return typeof defaultRole === 'string' ? defaultRole : 'member'
}

function EntityIcon({ summary }: { summary: EntitySummary | null }) {
  if (!summary?.icon) return <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
  return <Shield className="h-4 w-4 text-muted-foreground" />
}

function buildInspectorState(policy: RolePolicy): InspectorState {
  return {
    policy,
    visibilityDraft: prettyJson(policy.visibility),
    editabilityDraft: prettyJson(policy.editability),
    fieldsDraft: prettyJson(policy.fields || []),
    versionTag: String(policy.metadata?.version_tag || ''),
    versionNote: String(policy.metadata?.version_note || ''),
    saving: false,
    savingMessage: null,
  }
}

export default function RoleMatrixPage() {
  const { currentAccountId, profile } = useAuth()
  const [accountIdInput, setAccountIdInput] = useState('')
  const [packIdInput, setPackIdInput] = useState('')
  const [stateFilter, setStateFilter] = useState<'all' | 'account' | 'template'>('all')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [includeAccount, setIncludeAccount] = useState(true)
  const [includeTemplates, setIncludeTemplates] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [data, setData] = useState<RoleMatrixResponse | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [inspector, setInspector] = useState<InspectorState | null>(null)

  const isSystem = profile?.system_role === 'system_admin' || profile?.system_role === 'system_operator'

  useEffect(() => {
    if (currentAccountId) setAccountIdInput(currentAccountId)
  }, [currentAccountId])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function loadMatrix() {
    setLoading(true)
    setErrorMessage(null)
    const params = new URLSearchParams()
    if (accountIdInput) params.set('account_id', accountIdInput)
    if (packIdInput) params.set('pack_id', packIdInput)
    if (entityTypeFilter) params.set('entity_type', entityTypeFilter)
    params.set('state', stateFilter)
    params.set('include_account', String(includeAccount))
    params.set('include_templates', String(includeTemplates))

    try {
      const payload = await apiGet<RoleMatrixResponse>(`role-matrix?${params.toString()}`)
      setData(payload)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load role matrix')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  function openInspector(policy: RolePolicy) {
    setInspector(buildInspectorState(policy))
  }

  function updateInspector(partial: Partial<InspectorState>) {
    setInspector((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  async function handleSaveInspector() {
    if (!inspector) return
    const parsedFields = (() => {
      try {
        const json = JSON.parse(inspector.fieldsDraft)
        return Array.isArray(json) ? json : []
      } catch {
        return []
      }
    })()

    updateInspector({ saving: true, savingMessage: null })
    const payload: PolicyMutationPayload = {
      action: 'upsert_policy',
      entity_type: inspector.policy.entity_type,
      entity_id: inspector.policy.entity_id,
      account_id: inspector.policy.account_id,
      pack_id: inspector.policy.pack_id,
      ownership: inspector.policy.ownership,
      template_entity_id: inspector.policy.template_entity_id,
      visibility: tryParseJson(inspector.visibilityDraft),
      editability: tryParseJson(inspector.editabilityDraft),
      metadata: inspector.policy.metadata ?? {},
      fields: parsedFields,
      version_tag: inspector.versionTag || null,
      version_note: inspector.versionNote || null,
    }

    try {
      await apiPost('role-policy', payload)
      updateInspector({ saving: false, savingMessage: 'Policy saved' })
      await loadMatrix()
    } catch (err: any) {
      updateInspector({ saving: false, savingMessage: err?.message || 'Save failed' })
    }
  }

  async function handleDelete(policyId: string) {
    if (!window.confirm('Delete this role policy?')) return
    try {
      await apiPost('role-policy', { action: 'delete_policy', policy_id: policyId })
      if (inspector?.policy.id === policyId) setInspector(null)
      await loadMatrix()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Delete failed')
    }
  }

  const groupedPolicies = useMemo(() => {
    if (!data) return []
    const buckets = data.policies.reduce<Record<string, RolePolicy[]>>((acc, policy) => {
      acc[policy.entity_type] = acc[policy.entity_type] || []
      acc[policy.entity_type].push(policy)
      return acc
    }, {})
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const totals = data?.totals_by_entity ?? {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Role Matrix</h1>
        <p className="mt-1 text-muted-foreground">
          Inspect visibility/editability metadata across tenant overrides and pack templates. System operators can pivot across accounts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Scope results by account, pack, entity type, and dataset state.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs uppercase text-muted-foreground">Account</label>
            <Input
              value={accountIdInput}
              onChange={(e) => setAccountIdInput(e.target.value)}
              placeholder={currentAccountId || 'account uuid'}
              disabled={!isSystem && Boolean(currentAccountId)}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Pack</label>
            <Input value={packIdInput} onChange={(e) => setPackIdInput(e.target.value)} placeholder="pack uuid" />
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Entity Type</label>
            <Input value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)} placeholder="workflow_definition" />
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">State</label>
            <SelectNative
              value={stateFilter}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setStateFilter(event.target.value as 'all' | 'account' | 'template')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'account', label: 'Account Only' },
                { value: 'template', label: 'Template Only' },
              ]}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Include Account</label>
            <div className="flex items-center gap-3">
              <Switch checked={includeAccount} onCheckedChange={setIncludeAccount} />
              <span className="text-sm text-muted-foreground">Tenant overrides</span>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase text-muted-foreground">Include Templates</label>
            <div className="flex items-center gap-3">
              <Switch checked={includeTemplates} onCheckedChange={setIncludeTemplates} />
              <span className="text-sm text-muted-foreground">Pack defaults</span>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3 pt-2">
            <Button size="sm" onClick={loadMatrix} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh Matrix'}
            </Button>
            {errorMessage && <span className="text-xs text-destructive">{errorMessage}</span>}
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Loading policies…</p>}

      {!loading && data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Policies ({data.total})</CardTitle>
              <CardDescription>Click any row to inspect field overrides or edit metadata.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedPolicies.length === 0 && (
                <p className="text-sm text-muted-foreground">No policies found for current filters.</p>
              )}
              {groupedPolicies.map(([entityType, policies]) => (
                <div key={entityType} className="rounded-md border border-border">
                  <div className="flex items-center justify-between bg-muted px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <span>{entityType}</span>
                    <span>{policies.length}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {policies.map((policy) => {
                      const isExpanded = expanded.has(policy.id)
                      const visibilityDefault = resolveDefaultRole(policy.visibility)
                      const editDefault = resolveDefaultRole(policy.editability)
                      return (
                        <div key={policy.id}>
                          <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/70" onClick={() => toggleExpanded(policy.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <EntityIcon summary={policy.entity} />
                                <span className="font-medium">{policy.entity?.label || policy.entity_id}</span>
                                {policy.ownership === 'pack' ? <Badge variant="secondary">Pack</Badge> : <Badge>Tenant</Badge>}
                                {policy.pack && <span className="text-xs text-muted-foreground">· {policy.pack.name}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                visibility default: {visibilityDefault} · edit default: {editDefault}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openInspector(policy) }}>Inspect</Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(policy.id) }}>Delete</Button>
                          </button>
                          {isExpanded && (
                            <div className="bg-muted/30 px-5 py-3 text-sm">
                              <p className="text-xs text-muted-foreground">Field overrides</p>
                              {policy.fields.length === 0 ? (
                                <p className="text-xs text-muted-foreground">None</p>
                              ) : (
                                <ul className="space-y-2 text-xs">
                                  {policy.fields.map((field) => (
                                    <li key={field.id} className="rounded-md bg-background px-3 py-2">
                                      <div className="font-medium">{field.field_path}</div>
                                      <div className="text-muted-foreground">Vis: {resolveDefaultRole(field.visibility)} · Edit: {resolveDefaultRole(field.editability)}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Totals</CardTitle>
                <CardDescription>Counts by entity type for current selection.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.keys(totals).length === 0 ? (
                  <p className="text-muted-foreground">No data</p>
                ) : (
                  Object.entries(totals).map(([entityType, count]) => (
                    <div key={entityType} className="flex items-center justify-between">
                      <span>{entityType}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {inspector ? (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Editing Policy
                    <Button size="sm" variant="ghost" onClick={() => setInspector(null)}>
                      Close
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    {inspector.policy.entity?.label || inspector.policy.entity_id} · {inspector.policy.entity_type}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs">Visibility JSON</label>
                    <Textarea rows={4} value={inspector.visibilityDraft} onChange={(e) => updateInspector({ visibilityDraft: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs">Editability JSON</label>
                    <Textarea rows={4} value={inspector.editabilityDraft} onChange={(e) => updateInspector({ editabilityDraft: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs">Fields JSON (array)</label>
                    <Textarea rows={4} value={inspector.fieldsDraft} onChange={(e) => updateInspector({ fieldsDraft: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Version tag" value={inspector.versionTag} onChange={(e) => updateInspector({ versionTag: e.target.value })} />
                    <Input placeholder="Version note" value={inspector.versionNote} onChange={(e) => updateInspector({ versionNote: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="sm" onClick={handleSaveInspector} disabled={inspector.saving}>
                      {inspector.saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                    {inspector.savingMessage && <span className="text-xs text-muted-foreground">{inspector.savingMessage}</span>}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Inspector</CardTitle>
                  <CardDescription>Select a policy to edit visibility/editability metadata.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">No policy selected.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

