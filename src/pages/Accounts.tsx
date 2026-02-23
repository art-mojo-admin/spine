import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2 } from 'lucide-react'

export function AccountsPage() {
  const { currentAccountId, setCurrentAccountId } = useAuth()
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadAccounts()
  }, [currentAccountId])

  async function loadAccounts() {
    setLoading(true)
    try {
      const data = await apiGet<any[]>('accounts')
      setAccounts(data)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="mt-1 text-muted-foreground">Manage tenant accounts</p>
        </div>
        <Button onClick={() => navigate('/accounts/new')} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Account
        </Button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts found</p>
        ) : (
          accounts.map((acc: any) => (
            <Card
              key={acc.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => {
                if (acc.id !== currentAccountId) setCurrentAccountId(acc.id)
                navigate(`/accounts/${acc.id}`)
              }}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{acc.display_name}</p>
                  <p className="text-sm text-muted-foreground">{acc.account_type}</p>
                </div>
                <Badge variant={acc.status === 'active' ? 'default' : 'secondary'}>{acc.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
