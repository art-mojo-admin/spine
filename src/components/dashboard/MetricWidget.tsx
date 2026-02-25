import { useEffect, useState } from 'react'
import { apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

interface MetricWidgetProps {
  title: string
  config: Record<string, any>
}

export function MetricWidget({ title, config }: MetricWidgetProps) {
  const [value, setValue] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiPost<{ value: number }>('dashboard-data', { widget_type: 'metric', config })
      .then((res) => setValue(res.value))
      .catch(() => setValue(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <p className="text-2xl font-bold">{value ?? '—'}</p>
        )}
      </CardContent>
    </Card>
  )
}
