import { useCallback, useMemo } from 'react'
import WidthProvider, { Responsive } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { cn } from '@/lib/utils'
import { WIDGET_TYPE_MAP } from '@/lib/widgetRegistry'
import { LucideIconDisplay } from '@/components/app-builder/LucideIconPicker'
import type { PageConfig, WidgetConfig } from '@/lib/widgetRegistry'
import { getWidgetStyleProps } from '@/lib/widgetStyle'
import WidgetRendererContext from '@/components/page-renderer/WidgetRendererContext'

// Runtime imports for preview mode
import { ChartWidget } from '@/components/page-renderer/widgets/ChartWidget'
import { StatWidget } from '@/components/page-renderer/widgets/StatWidget'
import { CountWidget } from '@/components/page-renderer/widgets/CountWidget'
import { TableWidget } from '@/components/page-renderer/widgets/TableWidget'
import { ItemListWidget } from '@/components/page-renderer/widgets/ItemListWidget'
import { ContentWidget } from '@/components/page-renderer/widgets/ContentWidget'
import { NavTreeWidget } from '@/components/page-renderer/widgets/NavTreeWidget'
import { LinkListWidget } from '@/components/page-renderer/widgets/LinkListWidget'
import { HeadingWidget } from '@/components/page-renderer/widgets/HeadingWidget'
import { DividerWidget } from '@/components/page-renderer/widgets/DividerWidget'
import { SpacerWidget } from '@/components/page-renderer/widgets/SpacerWidget'
import { ViewEmbedWidget } from '@/components/page-renderer/widgets/ViewEmbedWidget'
import { TabsWidget } from '@/components/page-renderer/widgets/TabsWidget'
import { AccordionWidget } from '@/components/page-renderer/widgets/AccordionWidget'
import type { BuilderScope } from '@/lib/pageBuilderUtils'

const ResponsiveGridLayout = WidthProvider(Responsive)

type Breakpoint = 'lg' | 'md' | 'sm'

interface GridCanvasProps {
  widgets: WidgetConfig[]
  layoutConfig: PageConfig['layout']
  selectedWidgetId: string | null
  onSelect: (id: string | null) => void
  onLayoutChange: (layout: ReactGridLayout.Layout[], breakpoint: Breakpoint) => void
  previewMode: boolean
  activeBreakpoint: Breakpoint
  onEnterContainer?: (scope: BuilderScope) => void
}

export function GridCanvas({
  widgets,
  layoutConfig,
  selectedWidgetId,
  onSelect,
  onLayoutChange,
  previewMode,
  activeBreakpoint,
  onEnterContainer,
}: GridCanvasProps) {
  const renderWidgetPreview = useCallback((widget: WidgetConfig) => {
    switch (widget.widget_type) {
      case 'chart': return <ChartWidget config={widget} />
      case 'stat': return <StatWidget config={widget} />
      case 'count': return <CountWidget config={widget} />
      case 'table': return <TableWidget config={widget} />
      case 'item_list': return <ItemListWidget config={widget} />
      case 'content': return <ContentWidget config={widget} />
      case 'nav_tree': return <NavTreeWidget config={widget} />
      case 'link_list': return <LinkListWidget config={widget} />
      case 'heading': return <HeadingWidget config={widget} />
      case 'divider': return <DividerWidget />
      case 'spacer': return <SpacerWidget />
      case 'view_embed': return <ViewEmbedWidget config={widget} />
      case 'tabs': return <TabsWidget config={widget} />
      case 'accordion': return <AccordionWidget config={widget} />
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">{widget.widget_type}</p>
          </div>
        )
    }
  }, [])

  const layouts = useMemo(() => {
    const createLayout = (bp: Breakpoint, accessor: (w: any) => { x: number; y: number; w: number; h: number }) =>
      widgets.map((w) => {
        const pos = accessor(w)
        const def = WIDGET_TYPE_MAP.get(w.widget_type)
        return {
          i: w.id,
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          minW: def?.minSize?.w || 1,
          minH: def?.minSize?.h || 1,
          static: previewMode,
        }
      })

    const lg = createLayout('lg', (w) => w.position || { x: 0, y: 0, w: 6, h: 3 })
    const md = createLayout('md', (w) => w.position_md || w.position || { x: 0, y: 0, w: 4, h: 3 })
    const sm = createLayout('sm', (w) => w.position_sm || w.position_md || w.position || { x: 0, y: 0, w: 2, h: 3 })
    return { lg, md, sm }
  }, [widgets, previewMode])

  function handleLayoutChange(currentLayout: ReactGridLayout.Layout[], allLayouts: any) {
    if (previewMode) return
    const breakpoint = (allLayouts?.breakpoint || activeBreakpoint) as Breakpoint
    onLayoutChange(currentLayout, breakpoint)
  }

  function handleEnterContainer(widget: WidgetConfig) {
    if (!onEnterContainer) return
    if (widget.widget_type === 'tabs') {
      const tabs = widget.tabs_config?.tabs || []
      if (!tabs.length) return
      onEnterContainer({ kind: 'tabs', widgetId: widget.id, tabIndex: 0 })
    } else if (widget.widget_type === 'accordion') {
      const items = widget.accordion_config?.items || []
      if (!items.length) return
      onEnterContainer({ kind: 'accordion', widgetId: widget.id, itemIndex: 0 })
    }
  }

  return (
    <WidgetRendererContext.Provider value={{ renderWidget: renderWidgetPreview, layoutConfig }}>
      <div
        className="flex-1 overflow-y-auto bg-muted/30 p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null)
        }}
      >
        {widgets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Drag a widget from the palette to get started</p>
              <p className="text-xs text-muted-foreground">Or click any widget type in the left panel</p>
            </div>
          </div>
        ) : (
          <ResponsiveGridLayout
            layouts={layouts}
            breakpoints={layoutConfig.breakpoints}
            cols={layoutConfig.cols}
            rowHeight={layoutConfig.rowHeight}
            isDraggable={!previewMode}
            isResizable={!previewMode}
            containerPadding={[0, 0]}
            margin={[12, 12]}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
            measureBeforeMount={false}
          >
            {widgets.map((widget) => {
              const isSelected = selectedWidgetId === widget.id
              const def = WIDGET_TYPE_MAP.get(widget.widget_type)

              return (
                <div
                  key={widget.id}
                  className={cn(
                    'relative group rounded-lg transition-shadow',
                    isSelected && !previewMode && 'ring-2 ring-primary shadow-lg',
                    !previewMode && 'cursor-pointer',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!previewMode) onSelect(widget.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (!previewMode) handleEnterContainer(widget)
                  }}
                >
                  {/* Drag handle + label overlay */}
                  {!previewMode && (
                    <div className="widget-drag-handle absolute top-0 left-0 right-0 z-10 flex items-center gap-1 px-2 py-0.5 bg-background/80 backdrop-blur-sm rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                      <LucideIconDisplay name={def?.icon} className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground truncate">{widget.title || def?.label}</span>
                      {(widget.widget_type === 'tabs' || widget.widget_type === 'accordion') && (
                        <span className="ml-auto text-[9px] uppercase tracking-wide text-muted-foreground">Double-click to edit</span>
                      )}
                    </div>
                  )}

                  {/* Widget content */}
                  {(() => {
                    const { className: styleClass, style } = getWidgetStyleProps(widget.style)
                    return (
                      <div className={cn('h-full', styleClass)} style={style}>
                        {renderWidgetPreview(widget)}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </ResponsiveGridLayout>
        )}
      </div>
    </WidgetRendererContext.Provider>
  )
}
