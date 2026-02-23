import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KanbanSquare, TicketCheck, Link2 } from 'lucide-react'

export function PortalDashboardPage() {
  const navigate = useNavigate()
  const { profile, currentAccountId } = useAuth()
  const [linkedItems, setLinkedItems] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId || !profile?.person_id) return
    setLoading(true)

    async function load() {
      try {
        const [linksRes, ticketsRes] = await Promise.all([
          apiGet<any[]>('entity-links', {
            entity_type: 'person',
            entity_id: profile!.person_id,
            direction: 'source',
          }),
          apiGet<any[]>('tickets'),
        ])

        // Filter links to workflow items
        const itemLinks = (linksRes || []).filter(
          (l: any) => l.target_type === 'workflow_item',
        )
        setLinkedItems(itemLinks.slice(0, 5))

        // Filter tickets opened by or assigned to this person
        const myTickets = (ticketsRes || []).filter(
          (t: any) =>
            t.opened_by_person_id === profile!.person_id ||
            t.assigned_to_person_id === profile!.person_id,
        )
        setTickets(myTickets.slice(0, 5))
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
              My Linked Items
              <Badge variant="secondary" className="ml-auto">{linkedItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {linkedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked items yet.</p>
            ) : (
              linkedItems.map((link: any) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/workflow-items/${link.target_id}`)}
                >
                  <div>
                    <Badge variant="outline" className="text-[10px] mr-2">{link.link_type}</Badge>
                    <span className="text-xs text-muted-foreground">{link.target_id.slice(0, 8)}...</span>
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
              <TicketCheck className="h-4 w-4" />
              My Tickets
              <Badge variant="secondary" className="ml-auto">{tickets.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            ) : (
              tickets.map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                >
                  <span className="font-medium truncate">{ticket.subject}</span>
                  <div className="flex gap-1 ml-2">
                    <Badge variant="secondary" className="text-[10px]">{ticket.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{ticket.priority}</Badge>
                  </div>
                </div>
              ))
            )}
            {tickets.length > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => navigate('/my-tickets')}
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
