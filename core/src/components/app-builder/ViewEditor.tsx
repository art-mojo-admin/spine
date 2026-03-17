import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, X, ArrowUp, ArrowDown, GripVertical, Save } from 'lucide-react'

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

const MIN_ROLES = [
  { value: 'portal', label: 'Portal' },
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

interface PanelConfig {
  type: string
  position: number
  config?: Record<string, any>
}

interface ViewEditorProps {
  viewSlug: string
  viewDefs: any[]
  onReload: () => void
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function ViewEditor({ viewSlug, viewDefs, onReload }: ViewEditorProps) {
  const existing = viewDefs.find((v: any) => v.slug === viewSlug)

  const [name, setName] = useState(existing?.name || '')
  const [slug, setSlug] = useState(existing?.slug || viewSlug || '')
  const [viewType, setViewType] = useState(existing?.view_type || 'list')
  const [targetType, setTargetType] = useState(existing?.target_type || '')
  const [targetFilterJson, setTargetFilterJson] = useState(
    JSON.stringify(existing?.target_filter || {}, null, 2)
  )
  const [minRole, setMinRole] = useState(existing?.min_role || 'member')
  const [panels, setPanels] = useState<PanelConfig[]>(existing?.config?.panels || [])
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const v = viewDefs.find((vd: any) => vd.slug === viewSlug)
    if (v) {
      setName(v.name)
      setSlug(v.slug)
      setViewType(v.view_type)
      setTargetType(v.target_type || '')
      setTargetFilterJson(JSON.stringify(v.target_filter || {}, null, 2))
      setMinRole(v.min_role || 'member')
      setPanels(v.config?.panels || [])
    }
  }, [viewSlug, viewDefs])

  async function saveView() {
    if (!name.trim()) return
    setSaving(true)
    setErrorMsg(null)

    let targetFilter = {}
    try { targetFilter = JSON.parse(targetFilterJson) } catch {}

    const sortedPanels = panels.map((p, i) => ({ ...p, position: i }))

    const payload: any = {
      name,
      view_type: viewType,
      target_type: targetType || null,
      target_filter: targetFilter,
      min_role: minRole,
      config: { panels: sortedPanels },
    }

    try {
      if (existing) {
        await apiPatch('view-definitions', payload, { id: existing.id })
      } else {
        payload.slug = slug || slugify(name)
        await apiPost('view-definitions', payload)
      }
      onReload()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addPanel() {
    setPanels([...panels, { type: 'fields', position: panels.length, config: {} }])
  }

  function removePanel(index: number) {
    setPanels(panels.filter((_, i) => i !== index))
  }

  function updatePanel(index: number, updates: Partial<PanelConfig>) {
    setPanels(panels.map((p, i) => (i === index ? { ...p, ...updates } : p)))
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{existing ? 'Edit View' : 'New View'}</p>
        <Badge variant="outline" className="text-[10px] font-mono">{slug}</Badge>
      </div>

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deal Detail" />
      </div>

      {!existing && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Slug</label>
          <Input
            value={slug || (name ? slugify(name) : '')}
            onChange={(e) => setSlug(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="grid gap-3 grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">View Type</label>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={viewType}
            onChange={(e) => setViewType(e.target.value)}
          >
            {VIEW_TYPES.map((vt) => (
              <option key={vt.value} value={vt.value}>{vt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Target Type</label>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
          >
            {TARGET_TYPES.map((tt) => (
              <option key={tt.value} value={tt.value}>{tt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Min Role</label>
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={minRole}
          onChange={(e) => setMinRole(e.target.value)}
        >
          {MIN_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Target Filter (JSON)</label>
        <Textarea
          value={targetFilterJson}
          onChange={(e) => setTargetFilterJson(e.target.value)}
          rows={2}
          className="font-mono text-xs"
        />
      </div>

      {/* Panels */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Panels</label>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addPanel}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        </div>

        {panels.length === 0 && (
          <p className="text-[10px] text-muted-foreground">No panels configured.</p>
        )}

        {panels.map((panel, idx) => (
          <Card key={idx} className="border-dashed">
            <CardContent className="flex items-center gap-2 py-2 px-3">
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => movePanelUp(idx)} disabled={idx === 0}>
                  <ArrowUp className="h-2.5 w-2.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => movePanelDown(idx)} disabled={idx === panels.length - 1}>
                  <ArrowDown className="h-2.5 w-2.5" />
                </Button>
              </div>
              <select
                className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                value={panel.type}
                onChange={(e) => updatePanel(idx, { type: e.target.value })}
              >
                {PANEL_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => removePanel(idx)}>
                <X className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button size="sm" onClick={saveView} disabled={saving || !name.trim()}>
        <Save className="mr-1 h-3 w-3" /> {saving ? 'Saving...' : existing ? 'Save View' : 'Create View'}
      </Button>
    </div>
  )
}
