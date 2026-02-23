import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, ArrowLeft } from 'lucide-react'

const API_BASE = '/.netlify/functions'

interface PublicItem {
  id: string
  title?: string
  description?: string
  priority?: string
  due_date?: string
  created_at?: string
  stage?: string
  custom_fields?: Record<string, { label: string; value: any }>
}

export function PublicListingPage() {
  const { accountSlug, workflowId } = useParams<{ accountSlug: string; workflowId: string }>()
  const [workflow, setWorkflow] = useState<any>(null)
  const [items, setItems] = useState<PublicItem[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountSlug || !workflowId) return
    setLoading(true)
    fetch(`${API_BASE}/public-listings?account_slug=${accountSlug}&workflow_id=${workflowId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Not found')
        return res.json()
      })
      .then((data) => {
        setWorkflow(data.workflow)
        setItems(data.items || [])
        setStages(data.stages || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accountSlug, workflowId])

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
            <Link to={`/p/${accountSlug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
              Back
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
            <Link to={`/p/${accountSlug}`} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{workflow?.name}</h1>
              {workflow?.description && (
                <p className="text-sm text-muted-foreground">{workflow.description}</p>
              )}
            </div>
          </div>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {stages.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {stages.map((s: any) => (
              <Badge key={s.id} variant="outline">{s.name}</Badge>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No items available.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link key={item.id} to={`/p/${accountSlug}/${workflowId}/${item.id}`}>
                <Card className="transition-colors hover:bg-muted/50 cursor-pointer mb-3">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.title || 'Untitled'}</p>
                        {item.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {item.custom_fields && Object.keys(item.custom_fields).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(item.custom_fields).map(([key, field]) => (
                              <span key={key} className="text-xs text-muted-foreground">
                                <span className="font-medium">{field.label}:</span> {String(field.value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-4">
                        {item.stage && <Badge variant="secondary">{item.stage}</Badge>}
                        {item.priority && <Badge variant="outline" className="text-[10px]">{item.priority}</Badge>}
                        {item.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
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
