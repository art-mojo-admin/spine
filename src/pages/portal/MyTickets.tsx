import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TicketCheck } from 'lucide-react'

export function MyTicketsPage() {
  const navigate = useNavigate()
  const { profile, currentAccountId } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId || !profile?.person_id) return
    setLoading(true)

    apiGet<any[]>('tickets')
      .then((res) => {
        const mine = (res || []).filter(
          (t: any) =>
            t.opened_by_person_id === profile!.person_id ||
            t.assigned_to_person_id === profile!.person_id,
        )
        setTickets(mine)
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [currentAccountId, profile?.person_id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Tickets</h1>
        <p className="mt-1 text-muted-foreground">Tickets you opened or are assigned to</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TicketCheck className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/tickets/${ticket.id}`)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    Opened {new Date(ticket.created_at).toLocaleDateString()}
                    {ticket.category && ` • ${ticket.category}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                    {ticket.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{ticket.priority}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
