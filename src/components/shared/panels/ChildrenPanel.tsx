import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GitFork } from 'lucide-react'

interface ChildrenPanelProps {
  itemId: string
}

export function ChildrenPanel({ itemId }: ChildrenPanelProps) {
  const navigate = useNavigate()
  const [children, setChildren] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<any[]>('workflow-items', { parent_id: itemId })
      .then(setChildren)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [itemId])

  if (loading) return null
  if (children.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <GitFork className="h-4 w-4" />
          Child Items ({children.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {children.map((child: any) => (
          <div
            key={child.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
            onClick={() => navigate(`/workflow-items/${child.id}`)}
          >
            <span className="font-medium truncate">{child.title}</span>
            <div className="flex gap-1 ml-2">
              <Badge className="text-[10px]">{child.priority}</Badge>
              {child.stage_definitions?.name && (
                <Badge variant="secondary" className="text-[10px]">{child.stage_definitions.name}</Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
