import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { KanbanSquare, Inbox, Link2, PlusCircle } from 'lucide-react'

export function PortalDashboardPage() {
  const navigate = useNavigate()
  const { profile, currentAccountId } = useAuth()
  const [linkedItems, setLinkedItems] = useState<any[]>([])
  const [myTickets, setMyTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId || !profile?.person_id) return
    setLoading(true)

    async function load() {
      try {
        // Get all items linked to this person
        const links = await apiGet<any[]>('entity-links', {
          entity_type: 'person',
          entity_id: profile!.person_id || '',
          direction: 'source',
        })

        const itemLinks = (links || []).filter(
          (l: any) => l.target_type === 'item',
        )

        // Resolve item details for linked items
        const resolved: any[] = []
        for (const link of itemLinks.slice(0, 10)) {
          try {
            const item = await apiGet<any>('workflow-items', { id: link.target_id })
            resolved.push({ ...item, _link_type: link.link_type, _link_id: link.id })
          } catch {
            // skip unresolvable
          }
        }

        setLinkedItems(resolved.slice(0, 5))
        setMyTickets(resolved.filter((r: any) => r.item_type === 'ticket').slice(0, 5))
      } catch (err) {
        console.error('Portal dashboard load failed', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId, profile?.person_id])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {profile?.display_name}
        </h1>
        <p className="mt-1 text-muted-foreground">Your portal dashboard</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-4 w-4" />
              My Items
              <Badge variant="secondary" className="ml-auto">{linkedItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {linkedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items linked to you yet.</p>
            ) : (
              linkedItems.map((item: any) => (
                <div
                  key={item._link_id || item.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/workflow-items/${item.id}`)}
                >
                  <span className="font-medium truncate">{item.title || 'Untitled'}</span>
                  <div className="flex gap-1 ml-2">
                    <Badge variant="outline" className="text-[10px]">{item._link_type}</Badge>
                    {item.priority && <Badge variant="secondary" className="text-[10px]">{item.priority}</Badge>}
                  </div>
                </div>
              ))
            )}
            {linkedItems.length > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => navigate('/my-items')}
              >
                View all →
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Inbox className="h-4 w-4" />
              My Tickets
              <Badge variant="secondary" className="ml-auto">{myTickets.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets linked to you yet.</p>
            ) : (
              myTickets.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/workflow-items/${item.id}`)}
                >
                  <span className="font-medium truncate">{item.title}</span>
                  <div className="flex gap-1 ml-2">
                    {item.stage_definitions?.name && <Badge variant="outline" className="text-[10px]">{item.stage_definitions.name}</Badge>}
                    {item.priority && <Badge variant="secondary" className="text-[10px]">{item.priority}</Badge>}
                  </div>
                </div>
              ))
            )}
            {myTickets.length > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => navigate('/my-items')}
              >
                View all →
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
