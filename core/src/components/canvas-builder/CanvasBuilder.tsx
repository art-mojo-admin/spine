import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Eye, Pencil, Undo2, Redo2, Home } from 'lucide-react'
import { WidgetPalette } from './WidgetPalette'
import { GridCanvas } from './GridCanvas'
import { WidgetInspector } from './WidgetInspector'
import type { WidgetConfig, PageConfig } from '@/lib/widgetRegistry'
import { DEFAULT_PAGE_CONFIG, WIDGET_TYPE_MAP } from '@/lib/widgetRegistry'
import type { Layout, LayoutItem } from 'react-grid-layout/legacy'
import { cn } from '@/lib/utils'
import type { BuilderScope } from '@/lib/pageBuilderUtils'
import {
  ROOT_SCOPE,
  getWidgetsAtScope,
  updateConfigAtScope,
  findWidgetDeep,
  normalizeScopeStack,
  findScopePathForWidget,
} from '@/lib/pageBuilderUtils'

type Breakpoint = 'lg' | 'md' | 'sm'

const BREAKPOINT_LABELS: Record<Breakpoint, string> = {
  lg: 'Desktop',
  md: 'Tablet',
  sm: 'Mobile',
}

export function CanvasBuilderPage() {
  const { viewId } = useParams<{ viewId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()

  const [viewDef, setViewDef] = useState<any>(null)
  const [config, setConfig] = useState<PageConfig>(DEFAULT_PAGE_CONFIG)
  const [scopeStack, setScopeStack] = useState<BuilderScope[]>([ROOT_SCOPE])
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeBreakpoint, setActiveBreakpoint] = useState<Breakpoint>('lg')

  // Undo/redo
  const [history, setHistory] = useState<PageConfig[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedo = useRef(false)

  useEffect(() => {
    if (!viewId || !currentAccountId) return
    setLoading(true)
    apiGet<any>('view-definitions', { id: viewId })
      .then((vd) => {
        setViewDef(vd)
        const pageConfig = vd.config?.layout ? (vd.config as PageConfig) : { ...DEFAULT_PAGE_CONFIG, widgets: vd.config?.widgets || [] }
        setConfig(pageConfig)
        setHistory([pageConfig])
        setHistoryIndex(0)
        setScopeStack([ROOT_SCOPE])
      })
      .catch((err) => setError(err?.message || 'Failed to load view'))
      .finally(() => setLoading(false))
  }, [viewId, currentAccountId])

  const pushConfig = useCallback((newConfig: PageConfig) => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false
      return
    }
    setConfig(newConfig)
    setDirty(true)
    setScopeStack((prev) => normalizeScopeStack(newConfig, prev))
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1)
      return [...trimmed, newConfig]
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  function undo() {
    if (historyIndex <= 0) return
    isUndoRedo.current = true
    const newIndex = historyIndex - 1
    setHistoryIndex(newIndex)
    setConfig(history[newIndex])
    setScopeStack((prev) => normalizeScopeStack(history[newIndex], prev))
    setDirty(true)
  }

  function redo() {
    if (historyIndex >= history.length - 1) return
    isUndoRedo.current = true
    const newIndex = historyIndex + 1
    setHistoryIndex(newIndex)
    setConfig(history[newIndex])
    setScopeStack((prev) => normalizeScopeStack(history[newIndex], prev))
    setDirty(true)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveConfig() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  async function saveConfig() {
    if (!viewDef) return
    setSaving(true)
    setError(null)
    try {
      await apiPatch('view-definitions', { config }, { id: viewDef.id })
      setDirty(false)
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addWidget(widgetType: string) {
    const def = WIDGET_TYPE_MAP.get(widgetType)
    if (!def) return

    const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    // Find the lowest y position that's free
    const targetWidgets = getWidgetsAtScope(config, scopeStack)
    const maxY = targetWidgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0)

    const basePosition = { x: 0, y: maxY, w: def.defaultSize.w, h: def.defaultSize.h }

    const newWidget: WidgetConfig = {
      id,
      widget_type: widgetType,
      title: def.label,
      position: basePosition,
      position_md: { ...basePosition, w: Math.min(basePosition.w, config.layout.cols.md) },
      position_sm: { ...basePosition, w: Math.max(2, Math.min(basePosition.w, config.layout.cols.sm)), x: 0 },
    }

    if (def.hasDataSource) {
      newWidget.data_source = { entity: 'items', aggregate: 'count' }
    }

    if (widgetType === 'chart') {
      newWidget.chart_config = { type: 'bar' }
    }

    if (widgetType === 'content') {
      newWidget.content_config = { format: 'markdown', body: '' }
    }

    if (widgetType === 'heading') {
      newWidget.content_config = { format: 'markdown', body: 'New Heading' }
    }

    if (widgetType === 'nav_tree' || widgetType === 'link_list') {
      newWidget.nav_config = { items: [] }
    }

    if (widgetType === 'view_embed') {
      newWidget.embed_config = { view_slug: '' }
    }

    if (widgetType === 'tabs') {
      newWidget.tabs_config = { tabs: [{ label: 'Tab 1', widgets: [] }] }
    }

    if (widgetType === 'accordion') {
      newWidget.accordion_config = { items: [{ label: 'Section 1', widgets: [] }] }
    }

    const updatedConfig = updateConfigAtScope(config, scopeStack, (widgets) => [...widgets, newWidget])
    pushConfig(updatedConfig)
    setSelectedWidgetId(id)
  }

  function updateWidget(widgetId: string, updates: Partial<WidgetConfig>) {
    const targetWidget = findWidgetDeep(config, widgetId)
    if (!targetWidget) return
    const updatedConfig = updateConfigAtScope(config, scopeStack, (widgets) =>
      widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)),
    )
    pushConfig(updatedConfig)
  }

  function removeWidget(widgetId: string) {
    const updatedConfig = updateConfigAtScope(config, scopeStack, (widgets) => widgets.filter((w) => w.id !== widgetId))
    pushConfig(updatedConfig)
    if (selectedWidgetId === widgetId) setSelectedWidgetId(null)
  }

  function duplicateWidget(widgetId: string) {
    const targetWidgets = getWidgetsAtScope(config, scopeStack)
    const source = targetWidgets.find((w) => w.id === widgetId)
    if (!source) return

    const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const maxY = targetWidgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0)

    const clone: WidgetConfig = {
      ...JSON.parse(JSON.stringify(source)),
      id,
      title: `${source.title} (copy)`,
      position: { ...source.position, y: maxY },
      position_md: source.position_md ? { ...source.position_md, y: maxY } : undefined,
      position_sm: source.position_sm ? { ...source.position_sm, y: maxY } : undefined,
    }

    const updatedConfig = updateConfigAtScope(config, scopeStack, (widgets) => [...widgets, clone])
    pushConfig(updatedConfig)
    setSelectedWidgetId(id)
  }

  function onLayoutChange(layout: Layout, breakpoint: Breakpoint) {
    const targetWidgets = getWidgetsAtScope(config, scopeStack)
    const layoutMap = new Map(layout.map((item) => [item.i, item]))
    const updatedConfig = updateConfigAtScope(config, scopeStack, (widgets) =>
      widgets.map((w) => {
        const layoutItem = layoutMap.get(w.id)
        if (!layoutItem) return w

        const updatedPosition = { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h }

        if (breakpoint === 'lg') {
          return { ...w, position: updatedPosition }
        }
        if (breakpoint === 'md') {
          return { ...w, position_md: updatedPosition }
        }
        return { ...w, position_sm: updatedPosition }
      }),
    )
    pushConfig(updatedConfig)
  }

  const currentWidgets = getWidgetsAtScope(config, scopeStack)
  const selectedWidget = selectedWidgetId
    ? findWidgetDeep(config, selectedWidgetId)
    : null

  function enterScope(scope: BuilderScope) {
    setScopeStack((prev) => normalizeScopeStack(config, [...prev, scope]))
    setSelectedWidgetId(null)
  }

  function setScope(scopePath: BuilderScope[]) {
    const normalized = normalizeScopeStack(config, scopePath)
    setScopeStack(normalized)
    setSelectedWidgetId(null)
  }

  function jumpToChildScope(scope: BuilderScope) {
    if (scope.kind === 'root') {
      setScopeStack([ROOT_SCOPE])
      setSelectedWidgetId(null)
      return
    }

    const containerPath = findScopePathForWidget(config, scope.widgetId)
    if (!containerPath) return
    const nextStack = normalizeScopeStack(config, [...containerPath, scope])
    setScopeStack(nextStack)
    setSelectedWidgetId(null)
  }

  function renderBreadcrumb() {
    const crumbs = scopeStack.map((scope, idx) => {
      if (scope.kind === 'root') {
        return (
          <button
            key={`crumb-${idx}`}
            className={cn('flex items-center gap-1 text-xs', idx === scopeStack.length - 1 ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setScope(scopeStack.slice(0, idx + 1))}
          >
            <Home className="h-3 w-3" /> Root
          </button>
        )
      }

      const parentStack = scopeStack.slice(0, idx)
      const parentWidgets = getWidgetsAtScope(config, parentStack)
      const container = parentWidgets.find((w) => w.id === scope.widgetId)
      const baseLabel = container?.title || (scope.kind === 'tabs' ? 'Tabs' : 'Accordion')
      let detailLabel: string | null = null

      if (scope.kind === 'tabs') {
        const tab = container?.tabs_config?.tabs?.[scope.tabIndex]
        detailLabel = tab?.label || `Tab ${scope.tabIndex + 1}`
      } else {
        const item = container?.accordion_config?.items?.[scope.itemIndex]
        detailLabel = item?.label || `Section ${scope.itemIndex + 1}`
      }

      const label = detailLabel ? `${baseLabel} › ${detailLabel}` : baseLabel

      return (
        <button
          key={`crumb-${idx}`}
          className={cn('text-xs', idx === scopeStack.length - 1 ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
          onClick={() => setScope(scopeStack.slice(0, idx + 1))}
        >
          {label}
        </button>
      )
    })

    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {crumbs.reduce((acc: React.ReactNode[], crumb, idx) => {
          acc.push(crumb)
          if (idx < crumbs.length - 1) acc.push(<span key={`sep-${idx}`}>/</span>)
          return acc
        }, [])}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading builder...</p>
      </div>
    )
  }

  if (error && !viewDef) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => navigate('/admin/views')}>Back to Views</Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-2 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/views')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Views
        </Button>
        <h1 className="text-lg font-semibold">{viewDef?.name || 'Page Builder'}</h1>
        <Badge variant="secondary" className="text-[10px]">page</Badge>
        {dirty && <span className="text-xs text-muted-foreground">(unsaved)</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}

        <div className="ml-auto flex flex-col gap-2 items-end">
          <div>{renderBreadcrumb()}</div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-md border bg-background p-0.5">
              {(['lg', 'md', 'sm'] as Breakpoint[]).map((bp) => (
                <button
                  key={bp}
                  className={cn(
                    'px-2 py-1 text-xs rounded-sm transition-colors',
                    activeBreakpoint === bp ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => setActiveBreakpoint(bp)}
                >
                  {BREAKPOINT_LABELS[bp]}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} title="Undo (⌘Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (⌘⇧Z)">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
              title={previewMode ? 'Edit mode' : 'Preview mode'}
            >
              {previewMode ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={saveConfig} disabled={saving || !dirty}>
              <Save className="mr-1 h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {!previewMode && (
          <WidgetPalette onAddWidget={addWidget} />
        )}

        <GridCanvas
          widgets={currentWidgets}
          layoutConfig={config.layout}
          selectedWidgetId={selectedWidgetId}
          onSelect={setSelectedWidgetId}
          onLayoutChange={onLayoutChange}
          previewMode={previewMode}
          activeBreakpoint={activeBreakpoint}
          onEnterContainer={enterScope}
        />

        {!previewMode && selectedWidget && (
          <WidgetInspector
            widget={selectedWidget}
            onUpdate={(updates) => updateWidget(selectedWidget.id, updates)}
            onRemove={() => removeWidget(selectedWidget.id)}
            onDuplicate={() => duplicateWidget(selectedWidget.id)}
            scopeStack={scopeStack}
            onEnterChildScope={jumpToChildScope}
          />
        )}
      </div>
    </div>
  )
}
