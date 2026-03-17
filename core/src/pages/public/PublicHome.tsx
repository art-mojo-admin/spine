import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, ArrowRight } from 'lucide-react'

const API_BASE = '/.netlify/functions'

interface PublicWorkflow {
  id: string
  name: string
  description: string | null
  item_count: number
}

export function PublicHomePage() {
  const { accountSlug } = useParams<{ accountSlug: string }>()
  const [account, setAccount] = useState<{ display_name: string; slug: string } | null>(null)
  const [workflows, setWorkflows] = useState<PublicWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountSlug) return
    setLoading(true)
    fetch(`${API_BASE}/public-listings?account_slug=${accountSlug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Not found')
        return res.json()
      })
      .then((data) => {
        setAccount(data.account)
        setWorkflows(data.workflows || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accountSlug])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Link to="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
              Sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{account?.display_name}</h1>
            </div>
          </div>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {workflows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No public listings available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workflows.map((wf) => (
              <Link key={wf.id} to={`/p/${accountSlug}/${wf.id}`}>
                <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span>{wf.name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {wf.description && (
                      <p className="text-sm text-muted-foreground mb-2">{wf.description}</p>
                    )}
                    <Badge variant="secondary">{wf.item_count} items</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
