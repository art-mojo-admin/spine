import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { SelectNative } from '@/components/ui/select-native'
import { LayoutDashboard, Plus, Trash2, Save, Star, StarOff } from 'lucide-react'

const WIDGET_TYPES = [
  { value: 'metric', label: 'Metric' },
  { value: 'table', label: 'Table' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'chart', label: 'Chart' },
  { value: 'activity_feed', label: 'Activity Feed' },
]

interface DashboardDef {
  id: string
  slug: string
  title: string
  description: string | null
  is_default: boolean
  min_role: string
  created_at: string
}

export function DashboardsPage() {
  const { currentAccountId } = useAuth()
  const [dashboards, setDashboards] = useState<DashboardDef[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDefault, setNewDefault] = useState(false)
  const [newWidgets, setNewWidgets] = useState<Array<{
    widget_type: string
    title: string
    config: string
  }>>([])

  useEffect(() => {
    if (!currentAccountId) return
    refresh()
  }, [currentAccountId])

  function refresh() {
    setLoading(true)
    apiGet<DashboardDef[]>('dashboards')
      .then(setDashboards)
      .catch(() => setDashboards([]))
      .finally(() => setLoading(false))
  }

  function addWidget() {
    setNewWidgets((prev) => [...prev, { widget_type: 'metric', title: '', config: '{}' }])
  }

  function updateWidget(index: number, field: string, value: string) {
    setNewWidgets((prev) => {
      const next = [...prev]
      ;(next[index] as any)[field] = value
      return next
    })
  }

  function removeWidget(index: number) {
    setNewWidgets((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const widgets = newWidgets.map((w) => ({
        widget_type: w.widget_type,
        title: w.title || w.widget_type,
        config: JSON.parse(w.config || '{}'),
      }))
      await apiPost('dashboards', {
        title: newTitle,
        description: newDesc || undefined,
        is_default: newDefault,
        widgets,
      })
      setShowCreate(false)
      setNewTitle('')
      setNewDesc('')
      setNewDefault(false)
      setNewWidgets([])
      refresh()
    } catch {
      // Silently fail
    } finally {
      setCreating(false)
    }
  }

  async function handleSetDefault(id: string) {
    await apiPatch('dashboards', { is_default: true }, { id })
    refresh()
  }

  async function handleDelete(id: string) {
    await apiDelete('dashboards', { id })
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="mt-1 text-muted-foreground">Configure dashboards with widgets for your account</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1 h-4 w-4" />New Dashboard
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="My Dashboard" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" className="mt-1" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={newDefault} onChange={(e) => setNewDefault(e.target.checked)} className="rounded border" />
              Set as default dashboard
            </label>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Widgets</p>
                <Button variant="outline" size="sm" onClick={addWidget}>
                  <Plus className="mr-1 h-3 w-3" />Add Widget
                </Button>
              </div>
              {newWidgets.map((w, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-4 mb-2 p-2 border rounded-md">
                  <SelectNative value={w.widget_type} onChange={(e) => updateWidget(i, 'widget_type', e.target.value)}>
                    {WIDGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </SelectNative>
                  <Input value={w.title} onChange={(e) => updateWidget(i, 'title', e.target.value)} placeholder="Widget title" />
                  <Input value={w.config} onChange={(e) => updateWidget(i, 'config', e.target.value)} placeholder='{"key":"value"}' className="font-mono text-xs" />
                  <Button variant="ghost" size="sm" onClick={() => removeWidget(i)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
                <Save className="mr-1 h-4 w-4" />{creating ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard list */}
      {loading ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      ) : dashboards.length === 0 ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">No dashboards yet. Create one to get started.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {dashboards.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <LayoutDashboard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-sm text-muted-foreground">{d.description || d.slug}</p>
                  </div>
                  {d.is_default && <Badge>Default</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  {!d.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefault(d.id)} title="Set as default">
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
