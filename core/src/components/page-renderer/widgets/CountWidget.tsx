import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Hash } from 'lucide-react'
import { useWidgetData } from '../useWidgetData'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface CountWidgetProps {
  config: WidgetConfig
}

export function CountWidget({ config }: CountWidgetProps) {
  const { data, loading, error } = useWidgetData(config.data_source)
  const value = data?.total ?? 0

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hash className="h-4 w-4" />
          {config.title || 'Count'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        {loading ? (
          <p className="text-3xl font-bold text-muted-foreground/30">—</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        )}
      </CardContent>
    </Card>
  )
}
