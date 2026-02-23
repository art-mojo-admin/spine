import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Users } from 'lucide-react'

export function PersonsPage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [persons, setPersons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    apiGet<any[]>('persons')
      .then(setPersons)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Persons</h1>
          <p className="mt-1 text-muted-foreground">Manage people and their memberships</p>
        </div>
        <Button onClick={() => navigate('/persons/new')} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Person
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : persons.length === 0 ? (
        <p className="text-sm text-muted-foreground">No persons found</p>
      ) : (
        <div className="grid gap-3">
          {persons.map((p: any) => (
            <Card key={p.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/persons/${p.id}`)}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-sm text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.membership && <Badge variant="secondary">{p.membership.account_role}</Badge>}
                  <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  )
}
