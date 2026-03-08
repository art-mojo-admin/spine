import { useMemo } from 'react'
import { Responsive as ResponsiveReactGridLayout, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Layout, LayoutItem as RGLLayoutItem, ResponsiveLayouts } from 'react-grid-layout/legacy'
import type { WidgetConfig, PageConfig } from '@/lib/widgetRegistry'
import { cn } from '@/lib/utils'
import { getWidgetStyleProps } from '@/lib/widgetStyle'

const ResponsiveGridLayout = WidthProvider(ResponsiveReactGridLayout)

interface WidgetGridProps {
  widgets: WidgetConfig[]
  layoutConfig: PageConfig['layout']
  renderWidget: (widget: WidgetConfig) => React.ReactNode
  className?: string
  margin?: [number, number]
  containerPadding?: [number, number]
  emptyState?: React.ReactNode
}

type GridBreakpoint = 'lg' | 'md' | 'sm'

export function WidgetGrid({
  widgets,
  layoutConfig,
  renderWidget,
  className,
  margin = [16, 16],
  containerPadding = [0, 0],
  emptyState,
}: WidgetGridProps) {
  const layouts = useMemo<ResponsiveLayouts<GridBreakpoint>>(() => {
    const lg: RGLLayoutItem[] = []
    const md: RGLLayoutItem[] = []
    const sm: RGLLayoutItem[] = []

    for (const w of widgets) {
      const pos = w.position || { x: 0, y: 0, w: 6, h: 3 }
      lg.push({ i: w.id, x: pos.x, y: pos.y, w: pos.w, h: pos.h, static: true })

      const posMd = w.position_md || { ...pos, w: Math.min(pos.w, layoutConfig.cols.md) }
      md.push({ i: w.id, x: posMd.x, y: posMd.y, w: posMd.w, h: posMd.h, static: true })

      const posSm = w.position_sm || { x: 0, y: 0, w: layoutConfig.cols.sm, h: pos.h }
      sm.push({ i: w.id, x: posSm.x, y: posSm.y, w: posSm.w, h: posSm.h, static: true })
    }

    return {
      lg: lg as Layout,
      md: md as Layout,
      sm: sm as Layout,
    }
  }, [widgets, layoutConfig.cols.md, layoutConfig.cols.sm])

  if (widgets.length === 0) {
    return emptyState ? <>{emptyState}</> : null
  }

  return (
    <div className={className}>
      <ResponsiveGridLayout
        layouts={layouts}
        breakpoints={layoutConfig.breakpoints}
        cols={layoutConfig.cols}
        rowHeight={layoutConfig.rowHeight}
        isDraggable={false}
        isResizable={false}
        containerPadding={containerPadding}
        margin={margin}
      >
        {widgets.map((widget) => {
          const { className: styleClass, style } = getWidgetStyleProps(widget.style)
          return (
            <div key={widget.id} className={cn(styleClass)} style={style}>
              {renderWidget(widget)}
            </div>
          )
        })}
      </ResponsiveGridLayout>
    </div>
  )
}
