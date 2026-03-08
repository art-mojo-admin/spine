import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { List } from 'lucide-react'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface ItemListWidgetProps {
  config: WidgetConfig
}

export function ItemListWidget({ config }: ItemListWidgetProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ds = config.data_source
    if (!ds) { setLoading(false); return }

    const params: Record<string, string> = {}
    if (ds.filters?.item_type) params.item_type = ds.filters.item_type
    if (ds.filters?.workflow_definition_id) params.workflow_definition_id = ds.filters.workflow_definition_id
    if (ds.limit) params.limit = String(ds.limit)

    apiGet<any[]>('workflow-items', params)
      .then((data) => {
        let filtered = data || []
        if (ds.filters?.stage) {
          filtered = filtered.filter((item: any) => item.stage_definitions?.name === ds.filters!.stage)
        }
        if (ds.filters?.priority) {
          filtered = filtered.filter((item: any) => item.priority === ds.filters!.priority)
        }
        setItems(filtered.slice(0, ds.limit || 10))
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [JSON.stringify(config.data_source)])

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <List className="h-4 w-4" />
            {config.title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          <div className="space-y-1">
            {items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/workflow-items/${item.id}`)}
              >
                <span className="text-sm font-medium truncate">{item.title}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.stage_definitions?.name && (
                    <Badge variant="secondary" className="text-[10px]">{item.stage_definitions.name}</Badge>
                  )}
                  {item.priority && (
                    <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
