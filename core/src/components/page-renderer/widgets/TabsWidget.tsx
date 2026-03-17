import { useMemo, useState } from 'react'
import type { WidgetConfig } from '@/lib/widgetRegistry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { WidgetGrid } from '../WidgetGrid'
import { useWidgetRendererEnv } from '../WidgetRendererContext'

interface TabsWidgetProps {
  config: WidgetConfig
}

export function TabsWidget({ config }: TabsWidgetProps) {
  const { renderWidget, layoutConfig } = useWidgetRendererEnv()
  const tabs = config.tabs_config?.tabs || []
  const [activeIndex, setActiveIndex] = useState(0)
  const safeIndex = useMemo(() => {
    if (tabs.length === 0) return 0
    return Math.min(activeIndex, tabs.length - 1)
  }, [activeIndex, tabs.length])

  if (tabs.length === 0) {
    return (
      <Card className="h-full">
        {config.title && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex h-full min-h-[160px] items-center justify-center">
          <p className="text-xs text-muted-foreground">Configure tabs to display content.</p>
        </CardContent>
      </Card>
    )
  }

  const activeTab = tabs[safeIndex]

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
        </CardHeader>
      )}
      <div className="flex flex-shrink-0 gap-1 border-b px-4 overflow-x-auto">
        {tabs.map((tab, idx) => (
          <button
            key={`${tab.label || 'Tab'}-${idx}`}
            className={cn(
              'px-3 py-2 text-xs font-semibold rounded-t-md transition-colors whitespace-nowrap',
              safeIndex === idx
                ? 'bg-primary/10 text-primary border border-b-transparent border-primary'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            )}
            onClick={() => setActiveIndex(idx)}
          >
            {tab.label || `Tab ${idx + 1}`}
          </button>
        ))}
      </div>
      <CardContent className="flex-1 min-h-[220px] p-4">
        <WidgetGrid
          widgets={activeTab.widgets || []}
          layoutConfig={layoutConfig}
          renderWidget={renderWidget}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          className="min-h-[200px]"
          emptyState={(
            <div className="flex h-full min-h-[180px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              No widgets in this tab yet.
            </div>
          )}
        />
      </CardContent>
    </Card>
  )
}
