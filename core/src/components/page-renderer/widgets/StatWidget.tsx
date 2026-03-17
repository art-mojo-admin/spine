import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Hash } from 'lucide-react'
import { useWidgetData } from '../useWidgetData'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface StatWidgetProps {
  config: WidgetConfig
}

export function StatWidget({ config }: StatWidgetProps) {
  const { data, loading, error } = useWidgetData(config.data_source)
  const sc = config.stat_config

  const value = data?.rows?.[0]?.value ?? data?.total ?? 0
  const suffix = sc?.suffix || ''

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hash className="h-4 w-4" />
          {config.title || 'Stat'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        {loading ? (
          <p className="text-3xl font-bold text-muted-foreground/30">—</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
