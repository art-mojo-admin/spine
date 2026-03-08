import { useCallback, useMemo } from 'react'
import type { WidgetConfig, PageConfig } from '@/lib/widgetRegistry'
import { DEFAULT_PAGE_CONFIG } from '@/lib/widgetRegistry'
import { ChartWidget } from './widgets/ChartWidget'
import { StatWidget } from './widgets/StatWidget'
import { CountWidget } from './widgets/CountWidget'
import { TableWidget } from './widgets/TableWidget'
import { ItemListWidget } from './widgets/ItemListWidget'
import { ContentWidget } from './widgets/ContentWidget'
import { NavTreeWidget } from './widgets/NavTreeWidget'
import { LinkListWidget } from './widgets/LinkListWidget'
import { HeadingWidget } from './widgets/HeadingWidget'
import { DividerWidget } from './widgets/DividerWidget'
import { SpacerWidget } from './widgets/SpacerWidget'
import { ViewEmbedWidget } from './widgets/ViewEmbedWidget'
import { TabsWidget } from './widgets/TabsWidget'
import { AccordionWidget } from './widgets/AccordionWidget'
import WidgetRendererContext from './WidgetRendererContext'
import { WidgetGrid } from './WidgetGrid'

interface PageRendererProps {
  config: PageConfig
  name?: string
}

function renderWidget(widget: WidgetConfig) {
  switch (widget.widget_type) {
    case 'chart':
      return <ChartWidget config={widget} />
    case 'stat':
      return <StatWidget config={widget} />
    case 'count':
      return <CountWidget config={widget} />
    case 'table':
      return <TableWidget config={widget} />
    case 'item_list':
      return <ItemListWidget config={widget} />
    case 'content':
      return <ContentWidget config={widget} />
    case 'nav_tree':
      return <NavTreeWidget config={widget} />
    case 'link_list':
      return <LinkListWidget config={widget} />
    case 'heading':
      return <HeadingWidget config={widget} />
    case 'divider':
      return <DividerWidget />
    case 'spacer':
      return <SpacerWidget />
    case 'view_embed':
      return <ViewEmbedWidget config={widget} />
    case 'tabs':
      return <TabsWidget config={widget} />
    case 'accordion':
      return <AccordionWidget config={widget} />
    default:
      return (
        <div className="flex items-center justify-center h-full rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">Unknown widget: {widget.widget_type}</p>
        </div>
      )
  }
}

export function PageRenderer({ config, name }: PageRendererProps) {
  const layoutConfig = config.layout || DEFAULT_PAGE_CONFIG.layout
  const widgets = config.widgets || []

  const render = useCallback((widget: WidgetConfig) => renderWidget(widget), [])

  const contextValue = useMemo(() => ({ renderWidget: render, layoutConfig }), [render, layoutConfig])

  if (widgets.length === 0) {
    return (
      <div className="space-y-4">
        {name && <h1 className="text-3xl font-bold tracking-tight">{name}</h1>}
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">This page has no widgets yet.</p>
        </div>
      </div>
    )
  }

  return (
    <WidgetRendererContext.Provider value={contextValue}>
      <div className="space-y-4">
        {name && <h1 className="text-3xl font-bold tracking-tight">{name}</h1>}
        <WidgetGrid
          widgets={widgets}
          layoutConfig={layoutConfig}
          renderWidget={render}
          margin={[16, 16]}
          containerPadding={[0, 0]}
        />
      </div>
    </WidgetRendererContext.Provider>
  )
}
