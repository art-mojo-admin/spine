import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GitBranch } from 'lucide-react'

interface PipelineWidgetProps {
  title: string
  config: Record<string, any>
}

interface StageGroup {
  id: string
  name: string
  position: number
  is_terminal: boolean
  items: Array<{ id: string; title: string; priority: string }>
}

export function PipelineWidget({ title, config }: PipelineWidgetProps) {
  const navigate = useNavigate()
  const [stages, setStages] = useState<StageGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiPost<{ stages: StageGroup[] }>('dashboard-data', { widget_type: 'pipeline', config })
      .then((res) => setStages(res.stages))
      .catch(() => setStages([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => (
              <div key={stage.id} className="min-w-[180px] flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stage.name}
                  </p>
                  <Badge variant="outline" className="text-[10px]">{stage.items.length}</Badge>
                </div>
                <div className="space-y-1">
                  {stage.items.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border px-2 py-1.5 text-xs cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => navigate(`/workflow-items/${item.id}`)}
                    >
                      <p className="truncate font-medium">{item.title}</p>
                      <Badge className="text-[9px] mt-0.5">{item.priority}</Badge>
                    </div>
                  ))}
                  {stage.items.length > 8 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      +{stage.items.length - 8} more
                    </p>
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
