import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Globe } from 'lucide-react'

export function PortalBrowsePage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [account, setAccount] = useState<any>(null)
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)

    async function load() {
      try {
        const acct = await apiGet<any>('accounts', { id: currentAccountId! })
        setAccount(acct)

        if (acct?.slug) {
          const res = await fetch(`/.netlify/functions/public-listings?account_slug=${acct.slug}`)
          if (res.ok) {
            const data = await res.json()
            setWorkflows(data.workflows || [])
          }
        }
      } catch (err) {
        console.error('Browse load failed', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse</h1>
        <p className="mt-1 text-muted-foreground">Public listings from this organization</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !account?.slug ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No public listings configured for this organization.</p>
          </CardContent>
        </Card>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No public listings available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map((wf: any) => (
            <Card
              key={wf.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/p/${account.slug}/${wf.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{wf.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {wf.description && (
                  <p className="text-sm text-muted-foreground mb-2">{wf.description}</p>
                )}
                <Badge variant="secondary">{wf.item_count} items</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
