import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table } from 'lucide-react'

interface TableWidgetProps {
  title: string
  config: Record<string, any>
}

export function TableWidget({ title, config }: TableWidgetProps) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiPost<{ rows: any[] }>('dashboard-data', { widget_type: 'table', config })
      .then((res) => setRows(res.rows))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const columns = config.columns || ['title', 'status', 'priority']

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Table className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          <div className="space-y-1">
            {rows.slice(0, config.limit || 10).map((row: any, i: number) => (
              <div
                key={row.id || i}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                onClick={() => {
                  if (row.id && config.entity_type === 'workflow_items') {
                    navigate(`/workflow-items/${row.id}`)
                  }
                }}
              >
                <span className="truncate flex-1">{row.title || row.name || row.subject || '—'}</span>
                <div className="flex items-center gap-1 ml-2">
                  {row.priority && <Badge className="text-[10px]">{row.priority}</Badge>}
                  {row.status && <Badge variant="secondary" className="text-[10px]">{row.status}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
