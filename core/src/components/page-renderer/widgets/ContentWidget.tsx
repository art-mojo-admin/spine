import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MarkdownRenderer } from '@/components/shared/editor/MarkdownRenderer'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface ContentWidgetProps {
  config: WidgetConfig
}

export function ContentWidget({ config }: ContentWidgetProps) {
  const cc = config.content_config
  const body = cc?.body || ''

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 min-h-0 overflow-auto">
        {body ? (
          <MarkdownRenderer content={body} />
        ) : (
          <p className="text-sm text-muted-foreground italic">No content</p>
        )}
      </CardContent>
    </Card>
  )
}
