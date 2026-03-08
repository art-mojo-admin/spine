import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table } from 'lucide-react'
import { useWidgetData } from '../useWidgetData'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface TableWidgetProps {
  config: WidgetConfig
}

export function TableWidget({ config }: TableWidgetProps) {
  const { data, loading, error } = useWidgetData(config.data_source)

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Table className="h-4 w-4" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !data?.rows?.length ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Group</th>
                <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Value</th>
                <th className="text-right py-2 text-xs font-medium text-muted-foreground">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{row.group === '_total' ? 'Total' : row.group}</td>
                  <td className="py-2 pr-4 text-right">
                    <Badge variant="secondary" className="text-[10px]">{row.value.toLocaleString()}</Badge>
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
