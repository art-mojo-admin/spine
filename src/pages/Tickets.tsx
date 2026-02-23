import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export function TicketsPage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    apiGet<any[]>('tickets')
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  const priorityColor = (p: string) => p === 'urgent' || p === 'high' ? 'destructive' : p === 'medium' ? 'default' : 'secondary'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="mt-1 text-muted-foreground">Support ticket management</p>
        </div>
        <Button onClick={() => navigate('/tickets/new')} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Ticket
        </Button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tickets found</p>
        ) : (
          tickets.map((t: any) => (
            <Card key={t.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/tickets/${t.id}`)}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    Opened by {t.opened_by?.full_name || '—'} • {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={priorityColor(t.priority) as any}>{t.priority}</Badge>
                <Badge variant="outline">{t.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
