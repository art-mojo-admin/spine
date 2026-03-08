import { useState } from 'react'
import type { WidgetConfig } from '@/lib/widgetRegistry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { WidgetGrid } from '../WidgetGrid'
import { useWidgetRendererEnv } from '../WidgetRendererContext'

interface AccordionWidgetProps {
  config: WidgetConfig
}

export function AccordionWidget({ config }: AccordionWidgetProps) {
  const { renderWidget, layoutConfig } = useWidgetRendererEnv()
  const items = config.accordion_config?.items || []
  const [openIndex, setOpenIndex] = useState(items.length > 0 ? 0 : -1)

  function toggle(idx: number) {
    setOpenIndex((prev) => (prev === idx ? -1 : idx))
  }

  if (items.length === 0) {
    return (
      <Card className="h-full">
        {config.title && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex h-full min-height-[160px] items-center justify-center">
          <p className="text-xs text-muted-foreground">Add accordion items to display content.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
        </CardHeader>
      )}
      <div className="flex-1 overflow-y-auto divide-y">
        {items.map((item, idx) => {
          const isOpen = idx === openIndex
          return (
            <div key={`${item.label || 'Item'}-${idx}`} className="border-b last:border-b-0">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-muted/50"
                onClick={() => toggle(idx)}
              >
                <span>{item.label || `Section ${idx + 1}`}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform text-muted-foreground', isOpen ? 'rotate-180' : '')} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  <WidgetGrid
                    widgets={item.widgets || []}
                    layoutConfig={layoutConfig}
                    renderWidget={renderWidget}
                    margin={[12, 12]}
                    containerPadding={[0, 0]}
                    emptyState={(
                      <div className="flex h-full min-h-[120px] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                        No widgets in this section yet.
                      </div>
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
