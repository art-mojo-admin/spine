import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Power } from 'lucide-react'
import { AppTree } from '@/components/app-builder/AppTree'
import { AppInspector } from '@/components/app-builder/AppInspector'
import { AppOverview } from '@/components/app-builder/AppOverview'

export interface AppDef {
  id: string
  slug: string
  name: string
  icon: string | null
  description: string | null
  nav_items: NavItem[]
  default_view: string | null
  min_role: string
  integration_deps: string[]
  is_active: boolean
  ownership: string | null
  created_at: string
}

export interface NavItem {
  label: string
  icon?: string
  route_type: string
  view_slug?: string
  url?: string
  min_role: string
  position: number
}

export interface Selection {
  type: 'general' | 'nav_item' | 'view' | 'fields' | 'automations'
  index?: number
  viewSlug?: string
}

export function AppBuilderPage() {
  const { appId } = useParams<{ appId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()

  const [app, setApp] = useState<AppDef | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>({ type: 'general' })

  const [viewDefs, setViewDefs] = useState<any[]>([])
  const [customFields, setCustomFields] = useState<any[]>([])
  const [automationRules, setAutomationRules] = useState<any[]>([])

  const loadApp = useCallback(async () => {
    if (!appId || !currentAccountId) return
    setLoading(true)
    try {
      const [appData, views, fields, rules] = await Promise.all([
        apiGet<AppDef>('app-definitions', { id: appId }),
        apiGet<any[]>('view-definitions').catch(() => []),
        apiGet<any[]>('custom-field-definitions').catch(() => []),
        apiGet<any[]>('automation-rules').catch(() => []),
      ])
      setApp(appData)
      setViewDefs(views || [])
      setCustomFields(fields || [])
      setAutomationRules(rules || [])
      setDirty(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to load app')
    } finally {
      setLoading(false)
    }
  }, [appId, currentAccountId])

  useEffect(() => { loadApp() }, [loadApp])

  function updateApp(partial: Partial<AppDef>) {
    if (!app) return
    setApp({ ...app, ...partial })
    setDirty(true)
  }

  function updateNavItems(navItems: NavItem[]) {
    updateApp({ nav_items: navItems.map((item, i) => ({ ...item, position: i })) })
  }

  function addNavItem() {
    if (!app) return
    const newItem: NavItem = {
      label: 'New Item',
      icon: 'circle',
      route_type: 'view',
      view_slug: '',
      url: '',
      min_role: 'member',
      position: app.nav_items.length,
    }
    const updated = [...app.nav_items, newItem]
    updateNavItems(updated)
    setSelection({ type: 'nav_item', index: updated.length - 1 })
  }

  function removeNavItem(index: number) {
    if (!app) return
    const updated = app.nav_items.filter((_, i) => i !== index)
    updateNavItems(updated)
    if (selection.type === 'nav_item' && selection.index === index) {
      setSelection({ type: 'general' })
    }
  }

  function updateNavItem(index: number, partial: Partial<NavItem>) {
    if (!app) return
    const updated = app.nav_items.map((item, i) => i === index ? { ...item, ...partial } : item)
    updateNavItems(updated)
  }

  async function saveApp() {
    if (!app) return
    setSaving(true)
    setError(null)
    try {
      const updated = await apiPatch<AppDef>('app-definitions', {
        name: app.name,
        slug: app.slug,
        icon: app.icon,
        description: app.description,
        nav_items: app.nav_items,
        default_view: app.default_view,
        min_role: app.min_role,
        integration_deps: app.integration_deps,
      }, { id: app.id })
      setApp(updated)
      setDirty(false)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish() {
    if (!app) return
    setSaving(true)
    setError(null)
    try {
      // Save pending changes first
      const updated = await apiPatch<AppDef>('app-definitions', {
        name: app.name,
        slug: app.slug,
        icon: app.icon,
        description: app.description,
        nav_items: app.nav_items,
        default_view: app.default_view,
        min_role: app.min_role,
        integration_deps: app.integration_deps,
        is_active: !app.is_active,
      }, { id: app.id })
      setApp(updated)
      setDirty(false)
    } catch (err: any) {
      setError(err?.message || 'Publish failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading builder...</p>
      </div>
    )
  }

  if (error && !app) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => navigate('/admin/apps')}>Back to Apps</Button>
      </div>
    )
  }

  if (!app) return null

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/apps')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Apps
        </Button>
        <h1 className="text-lg font-semibold">{app.name}</h1>
        <Badge variant={app.is_active ? 'default' : 'secondary'} className="text-[10px]">
          {app.is_active ? 'Active' : 'Draft'}
        </Badge>
        {dirty && <span className="text-xs text-muted-foreground">(unsaved changes)</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={saveApp} disabled={saving || !dirty}>
            <Save className="mr-1 h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant={app.is_active ? 'secondary' : 'default'}
            onClick={togglePublish}
            disabled={saving}
          >
            <Power className="mr-1 h-3 w-3" />
            {app.is_active ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: App Tree */}
        <AppTree
          app={app}
          selection={selection}
          onSelect={setSelection}
          onReorderNav={updateNavItems}
          onAddNavItem={addNavItem}
          customFieldCount={customFields.length}
          automationCount={automationRules.length}
        />

        {/* Center: Overview / Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
          <AppOverview
            app={app}
            selection={selection}
            viewDefs={viewDefs}
            customFields={customFields}
            automationRules={automationRules}
          />
        </div>

        {/* Right: Inspector */}
        {selection && (
          <AppInspector
            app={app}
            selection={selection}
            viewDefs={viewDefs}
            customFields={customFields}
            automationRules={automationRules}
            onUpdateApp={updateApp}
            onUpdateNavItem={updateNavItem}
            onRemoveNavItem={removeNavItem}
            onReloadData={loadApp}
          />
        )}
      </div>
    </div>
  )
}
