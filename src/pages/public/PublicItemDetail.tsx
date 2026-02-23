import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { apiPost } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Link2, LogIn } from 'lucide-react'

const API_BASE = '/.netlify/functions'

export function PublicItemDetailPage() {
  const { accountSlug, workflowId, itemId } = useParams<{
    accountSlug: string
    workflowId: string
    itemId: string
  }>()
  const { session, profile } = useAuth()

  const [item, setItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [linked, setLinked] = useState(false)

  useEffect(() => {
    if (!accountSlug || !itemId) return
    setLoading(true)
    fetch(`${API_BASE}/public-listings?account_slug=${accountSlug}&item_id=${itemId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Not found')
        return res.json()
      })
      .then((data) => setItem(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accountSlug, itemId])

  async function handleInteract(linkType: string) {
    if (!profile?.person_id || !itemId) return
    setLinking(true)
    try {
      await apiPost('entity-links', {
        source_type: 'person',
        source_id: profile.person_id,
        target_type: 'workflow_item',
        target_id: itemId,
        link_type: linkType,
      })
      setLinked(true)
    } catch (err: any) {
      if (err.status === 409) {
        setLinked(true)
      } else {
        setError(err.message)
      }
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Link
              to={`/p/${accountSlug}/${workflowId}`}
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Back to listing
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
            <Link
              to={`/p/${accountSlug}/${workflowId}`}
              className="text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold">{item?.title || 'Item Detail'}</h1>
          </div>
          {!session ? (
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
              Sign in
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">Signed in</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{item?.title || 'Untitled'}</span>
              <div className="flex gap-2">
                {item?.stage && <Badge variant="secondary">{item.stage}</Badge>}
                {item?.priority && <Badge variant="outline">{item.priority}</Badge>}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {item?.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{item.description}</p>
              </div>
            )}

            {item?.due_date && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Date</p>
                <p className="text-sm">{new Date(item.due_date).toLocaleDateString()}</p>
              </div>
            )}

            {item?.custom_fields && Object.keys(item.custom_fields).length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 border-t pt-4">
                {Object.entries(item.custom_fields).map(([key, field]: [string, any]) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                    <p className="text-sm">{String(field.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {item?.created_at && (
              <p className="text-xs text-muted-foreground">
                Posted {new Date(item.created_at).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Interaction section */}
        <Card>
          <CardContent className="py-4">
            {!session ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Sign in to interact with this item.</p>
                <Link to="/login">
                  <Button size="sm" variant="outline">
                    <LogIn className="mr-1 h-4 w-4" /> Sign in
                  </Button>
                </Link>
              </div>
            ) : linked ? (
              <div className="text-center py-2">
                <Badge className="text-sm">You're connected to this item</Badge>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground mr-2">Interact:</p>
                <Button
                  size="sm"
                  onClick={() => handleInteract('participant')}
                  disabled={linking}
                >
                  <Link2 className="mr-1 h-4 w-4" />
                  {linking ? 'Joining...' : 'Join / RSVP'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleInteract('interested')}
                  disabled={linking}
                >
                  Interested
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card>
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
