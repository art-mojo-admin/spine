import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid } from 'lucide-react'
import type { WidgetConfig } from '@/lib/widgetRegistry'

interface ViewEmbedWidgetProps {
  config: WidgetConfig
}

export function ViewEmbedWidget({ config }: ViewEmbedWidgetProps) {
  const navigate = useNavigate()
  const viewSlug = config.embed_config?.view_slug
  const [viewDef, setViewDef] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!viewSlug) { setLoading(false); return }

    async function load() {
      try {
        const vd = await apiGet<any>('view-definitions', { slug: viewSlug! })
        setViewDef(vd)

        if (vd.target_type === 'item' || vd.target_type === 'document' || vd.view_type === 'list') {
          const params: Record<string, string> = {}
          if (vd.target_filter?.workflow_definition_id) params.workflow_definition_id = vd.target_filter.workflow_definition_id
          if (vd.target_filter?.item_type) params.item_type = vd.target_filter.item_type
          else if (vd.target_type === 'document') params.item_type = 'article,course,lesson'
          const data = await apiGet<any[]>('workflow-items', params)
          setItems((data || []).slice(0, 10))
        }
      } catch {}
      setLoading(false)
    }

    load()
  }, [viewSlug])

  if (!viewSlug) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No view configured</p>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          {config.title || viewDef?.name || viewSlug}
        </CardTitle>
      </CardHeader>
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
                <div className="flex gap-1 flex-shrink-0">
                  {item.stage_definitions?.name && (
                    <Badge variant="secondary" className="text-[10px]">{item.stage_definitions.name}</Badge>
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
