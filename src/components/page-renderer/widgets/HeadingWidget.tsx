import type { WidgetConfig } from '@/lib/widgetRegistry'

interface HeadingWidgetProps {
  config: WidgetConfig
}

export function HeadingWidget({ config }: HeadingWidgetProps) {
  const body = config.content_config?.body || config.title || ''

  return (
    <div className="flex items-center h-full px-2">
      <h2 className="text-xl font-bold tracking-tight">{body}</h2>
    </div>
  )
}
