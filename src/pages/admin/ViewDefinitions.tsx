import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, LayoutGrid, Pencil, Trash2, Power, GripVertical, X, ArrowUp, ArrowDown, Copy } from 'lucide-react'

const VIEW_TYPES = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'detail', label: 'Detail' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'portal_page', label: 'Portal Page' },
]

const TARGET_TYPES = [
  { value: '', label: '— None —' },
  { value: 'item', label: 'Item' },
  { value: 'account', label: 'Account' },
  { value: 'person', label: 'Person' },
  { value: 'document', label: 'Document' },
  { value: 'thread', label: 'Thread' },
]

const MIN_ROLES = [
  { value: 'portal', label: 'Portal' },
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

const PANEL_TYPES = [
  { value: 'fields', label: 'Fields' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'activity', label: 'Activity' },
  { value: 'children', label: 'Children' },
  { value: 'threads', label: 'Threads' },
  { value: 'links', label: 'Entity Links' },
  { value: 'attachments', label: 'Attachments' },
  { value: 'custom_fields', label: 'Custom Fields' },
]

interface PanelConfig {
  type: string
  position: number
  config?: Record<string, any>
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function ViewDefinitionsPage() {
  const { currentAccountId } = useAuth()
  const [views, setViews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('all')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingView, setEditingView] = useState<any>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [viewType, setViewType] = useState('detail')
  const [targetType, setTargetType] = useState('')
  const [targetFilterJson, setTargetFilterJson] = useState('{}')
  const [minRole, setMinRole] = useState('member')
  const [panels, setPanels] = useState<PanelConfig[]>([])

  useEffect(() => { if (currentAccountId) loadViews() }, [currentAccountId])

  async function loadViews() {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      const data = await apiGet<any[]>('view-definitions', params)
      setViews(data)
    } catch { setViews([]) }
    setLoading(false)
  }

  function resetForm() {
    setName(''); setSlug(''); setViewType('detail'); setTargetType('')
    setTargetFilterJson('{}'); setMinRole('member'); setPanels([])
    setShowForm(false); setEditingView(null)
  }

  function startEdit(v: any) {
    setEditingView(v)
    setName(v.name)
    setSlug(v.slug)
    setViewType(v.view_type)
    setTargetType(v.target_type || '')
    setTargetFilterJson(JSON.stringify(v.target_filter || {}, null, 2))
    setMinRole(v.min_role || 'member')
    setPanels(v.config?.panels || [])
    setShowForm(true)
  }

  function duplicateView(v: any) {
    setEditingView(null)
    setName(`${v.name} (copy)`)
    setSlug(`${v.slug}-copy`)
    setViewType(v.view_type)
    setTargetType(v.target_type || '')
    setTargetFilterJson(JSON.stringify(v.target_filter || {}, null, 2))
    setMinRole(v.min_role || 'member')
    setPanels((v.config?.panels || []).map((p: PanelConfig, i: number) => ({ ...p, position: i })))
    setShowForm(true)
  }

  async function saveView() {
    if (!name.trim() || !viewType) return

    let targetFilter = {}
    try { targetFilter = JSON.parse(targetFilterJson) } catch { /* keep empty */ }

    const sortedPanels = panels.map((p, i) => ({ ...p, position: i }))

    const payload: any = {
      name,
      view_type: viewType,
      target_type: targetType || null,
      target_filter: targetFilter,
      min_role: minRole,
      config: { panels: sortedPanels },
    }

    if (editingView) {
      await apiPatch('view-definitions', payload, { id: editingView.id })
    } else {
      payload.slug = slug || slugify(name)
      await apiPost('view-definitions', payload)
    }

    resetForm()
    loadViews()
  }

  async function toggleView(v: any) {
    await apiPatch('view-definitions', { is_active: !v.is_active }, { id: v.id })
    loadViews()
  }

  async function deleteView(id: string) {
    if (!confirm('Delete this view definition?')) return
    await apiDelete(`view-definitions?id=${id}`)
    loadViews()
  }

  // Panel helpers
  function addPanel() {
    setPanels([...panels, { type: 'fields', position: panels.length, config: {} }])
  }

  function removePanel(index: number) {
    setPanels(panels.filter((_, i) => i !== index))
  }

  function updatePanel(index: number, updates: Partial<PanelConfig>) {
    setPanels(panels.map((p, i) => i === index ? { ...p, ...updates } : p))
  }

  function movePanelUp(index: number) {
    if (index === 0) return
    const copy = [...panels]
    ;[copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]
    setPanels(copy)
  }

  function movePanelDown(index: number) {
    if (index === panels.length - 1) return
    const copy = [...panels]
    ;[copy[index], copy[index + 1]] = [copy[index + 1], copy[index]]
    setPanels(copy)
  }

  const filteredViews = tab === 'all'
    ? views
    : views.filter(v => v.view_type === tab)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">View Definitions</h1>
        <p className="mt-1 text-muted-foreground">Configure how entities are displayed — detail layouts, list views, boards, and dashboards</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setTab('all')}>
          All
        </Button>
        {VIEW_TYPES.map(vt => (
          <Button key={vt.value} variant={tab === vt.value ? 'default' : 'outline'} size="sm" onClick={() => setTab(vt.value)}>
            {vt.label}
          </Button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="mr-1 h-3 w-3" /> New View
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingView ? 'Edit' : 'New'} View Definition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Deal Detail" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={slug || (name ? slugify(name) : '')}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="auto-generated"
                  disabled={!!editingView}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">View Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={viewType}
                  onChange={e => setViewType(e.target.value)}
                >
                  {VIEW_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Target Type</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={targetType}
                  onChange={e => setTargetType(e.target.value)}
                >
                  {TARGET_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Min Role</label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={minRole}
                  onChange={e => setMinRole(e.target.value)}
                >
                  {MIN_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Target Filter (JSON)</label>
              <Textarea
                value={targetFilterJson}
                onChange={e => setTargetFilterJson(e.target.value)}
                rows={2}
                className="font-mono text-xs"
                placeholder='e.g. {"item_type": "deal"}'
              />
              <p className="text-[10px] text-muted-foreground">
                Narrows which entities this view applies to. Use {"{"}"item_type": "deal"{"}"} to match only deal items.
              </p>
            </div>

            {/* Panels Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Panels</label>
                <Button variant="outline" size="sm" onClick={addPanel}>
                  <Plus className="mr-1 h-3 w-3" /> Add Panel
                </Button>
              </div>

              {panels.length === 0 && (
                <p className="text-sm text-muted-foreground">No panels configured. Add panels to define the layout.</p>
              )}

              {panels.map((panel, idx) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="flex items-start gap-3 py-3">
                    <div className="flex flex-col gap-1 pt-1">
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => movePanelUp(idx)} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => movePanelDown(idx)} disabled={idx === panels.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Panel Type</label>
                          <select
                            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                            value={panel.type}
                            onChange={e => updatePanel(idx, { type: e.target.value })}
                          >
                            {PANEL_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Panel Config (JSON)</label>
                          <Input
                            className="font-mono text-xs"
                            value={JSON.stringify(panel.config || {})}
                            onChange={e => {
                              try {
                                updatePanel(idx, { config: JSON.parse(e.target.value) })
                              } catch { /* keep current */ }
                            }}
                            placeholder="{}"
                          />
                        </div>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive mt-1" onClick={() => removePanel(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={saveView} disabled={!name.trim()}>{editingView ? 'Save' : 'Create'}</Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View list */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : filteredViews.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">
            No view definitions{tab !== 'all' ? ` of type "${tab}"` : ''}. Click "New View" to create one.
          </p>
        ) : (
          filteredViews.map((v: any) => (
            <Card key={v.id} className={!v.is_active ? 'opacity-60' : ''}>
              <CardContent className="flex items-center gap-4 py-3">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{v.name}</p>
                    <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {v.slug}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px]">{v.view_type}</Badge>
                    {v.target_type && <Badge variant="outline" className="text-[10px]">{v.target_type}</Badge>}
                    {v.min_role !== 'member' && <Badge variant="outline" className="text-[10px]">min: {v.min_role}</Badge>}
                    {v.config?.panels?.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {v.config.panels.length} panel{v.config.panels.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {v.target_filter && Object.keys(v.target_filter).length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        filter: {JSON.stringify(v.target_filter)}
                      </span>
                    )}
                    {v.ownership === 'pack' && <Badge variant="outline" className="text-[10px]">pack</Badge>}
                  </div>
                </div>
                <Badge variant={v.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {v.is_active ? 'Active' : 'Off'}
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => duplicateView(v)} title="Duplicate">
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEdit(v)} title="Edit">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleView(v)} title="Toggle">
                  <Power className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteView(v.id)} title="Delete">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
