import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Hash, List, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Widget {
  widget_type: string
  title: string
  config: Record<string, any>
  position: { x: number; y: number; w: number; h: number }
}

interface DashboardRendererProps {
  name: string
  widgets: Widget[]
}

export function DashboardRenderer({ name, widgets }: DashboardRendererProps) {
  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y
    return a.position.x - b.position.x
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-muted-foreground">Dashboard</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {sortedWidgets.map((widget, i) => (
          <div
            key={i}
            className={`col-span-${Math.min(widget.position.w, 6)}`}
            style={{ gridColumn: `span ${Math.min(widget.position.w, 6)}` }}
          >
            <WidgetCard widget={widget} />
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetCard({ widget }: { widget: Widget }) {
  switch (widget.widget_type) {
    case 'count':
      return <CountWidget title={widget.title} config={widget.config} />
    case 'list':
      return <ListWidget title={widget.title} config={widget.config} />
    case 'stat':
      return <StatWidget title={widget.title} config={widget.config} />
    default:
      return (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">Unknown widget: {widget.widget_type}</p>
          </CardContent>
        </Card>
      )
  }
}

function CountWidget({ title, config }: { title: string; config: Record<string, any> }) {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCount() {
      setLoading(true)
      try {
        const entityType = config.entity_type || 'items'
        const filters = config.filters || {}

        if (entityType === 'items') {
          const params: Record<string, string> = {}
          if (filters.item_type) params.item_type = filters.item_type
          if (filters.workflow_definition_id) params.workflow_definition_id = filters.workflow_definition_id

          const data = await apiGet<any[]>('workflow-items', params)
          let filtered = data || []

          if (filters.stage) {
            filtered = filtered.filter((item: any) => item.stage_definitions?.name === filters.stage)
          }
          if (filters.priority) {
            filtered = filtered.filter((item: any) => item.priority === filters.priority)
          }

          setCount(filtered.length)
        } else if (entityType === 'persons') {
          const data = await apiGet<any[]>('persons')
          setCount((data || []).length)
        } else if (entityType === 'accounts') {
          const data = await apiGet<any[]>('accounts')
          setCount((data || []).length)
        } else if (entityType === 'kb_articles') {
          const data = await apiGet<any[]>('kb-articles')
          setCount((data || []).length)
        } else {
          setCount(0)
        }
      } catch {
        setCount(0)
      } finally {
        setLoading(false)
      }
    }

    fetchCount()
  }, [config.entity_type, JSON.stringify(config.filters)])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hash className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-3xl font-bold text-muted-foreground/30">—</p>
        ) : (
          <p className="text-3xl font-bold">{count}</p>
        )}
      </CardContent>
    </Card>
  )
}

function StatWidget({ title, config }: { title: string; config: Record<string, any> }) {
  const value = config.value ?? '—'
  const trend = config.trend // 'up' | 'down' | 'flat'
  const suffix = config.suffix || ''

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-bold">{value}{suffix}</p>
          {trend && <TrendIcon className={`h-5 w-5 mb-1 ${trendColor}`} />}
        </div>
      </CardContent>
    </Card>
  )
}

function ListWidget({ title, config }: { title: string; config: Record<string, any> }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchItems() {
      setLoading(true)
      try {
        const filters = config.filters || {}
        const limit = config.limit || 5
        const params: Record<string, string> = {}
        if (filters.item_type) params.item_type = filters.item_type
        if (filters.workflow_definition_id) params.workflow_definition_id = filters.workflow_definition_id

        const data = await apiGet<any[]>('workflow-items', params)
        let filtered = data || []

        if (filters.stage) {
          filtered = filtered.filter((item: any) => item.stage_definitions?.name === filters.stage)
        }
        if (filters.priority) {
          filtered = filtered.filter((item: any) => item.priority === filters.priority)
        }

        setItems(filtered.slice(0, limit))
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [JSON.stringify(config)])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <List className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          <div className="space-y-2">
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
