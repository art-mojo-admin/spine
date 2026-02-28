import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KanbanSquare } from 'lucide-react'

export function MyItemsPage() {
  const navigate = useNavigate()
  const { profile, currentAccountId } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [resolvedItems, setResolvedItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId || !profile?.person_id) return
    setLoading(true)

    async function load() {
      try {
        const links = await apiGet<any[]>('entity-links', {
          entity_type: 'person',
          entity_id: profile!.person_id || '',
          direction: 'source',
        })

        const itemLinks = (links || []).filter(
          (l: any) => l.target_type === 'item',
        )

        // Resolve item details
        const resolved = []
        for (const link of itemLinks) {
          try {
            const item = await apiGet<any>('workflow-items', { id: link.target_id })
            resolved.push({ ...item, _link_type: link.link_type, _link_id: link.id })
          } catch {
            resolved.push({
              id: link.target_id,
              title: link.target_id.slice(0, 8) + '...',
              _link_type: link.link_type,
              _link_id: link.id,
            })
          }
        }
        setResolvedItems(resolved)
      } catch (err) {
        console.error('Failed to load my items', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId, profile?.person_id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Items</h1>
        <p className="mt-1 text-muted-foreground">Workflow items linked to you</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : resolvedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <KanbanSquare className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No items linked to you yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {resolvedItems.map((item) => (
            <Card
              key={item._link_id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/workflow-items/${item.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title || 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.workflow_definitions?.name || 'Workflow'} • {item.stage_definitions?.name || 'Stage'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="outline" className="text-[10px]">{item._link_type}</Badge>
                  {item.priority && <Badge variant="secondary" className="text-[10px]">{item.priority}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
