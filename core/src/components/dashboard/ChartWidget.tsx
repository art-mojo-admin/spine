import { useEffect, useState } from 'react'
import { apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

interface ChartWidgetProps {
  title: string
  config: Record<string, any>
}

interface ChartDataPoint {
  name: string
  value: number
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe']

export function ChartWidget({ title, config }: ChartWidgetProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [chartType, setChartType] = useState('bar')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiPost<{ data: ChartDataPoint[]; chart_type: string }>('dashboard-data', { widget_type: 'chart', config })
      .then((res) => {
        setData(res.data)
        setChartType(res.chart_type || 'bar')
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : chartType === 'pie' ? (
          <div className="space-y-2">
            {data.map((d, i) => {
              const total = data.reduce((sum, item) => sum + item.value, 0)
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
              return (
                <div key={d.name} className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm flex-1 truncate">{d.name}</span>
                  <span className="text-sm font-medium">{d.value}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((d, i) => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs truncate">{d.name}</span>
                  <span className="text-xs font-medium ml-2">{d.value}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(d.value / maxValue) * 100}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
