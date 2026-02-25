import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText } from 'lucide-react'
import { APP_NAME } from '@/lib/config'

export function DocumentsPage() {
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    apiGet<any[]>('kb-articles')
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="mt-1 text-muted-foreground">Documents, SOPs, policies, and templates</p>
        </div>
        <Button onClick={() => navigate('/documents/new')} size="sm">
          <Plus className="mr-2 h-4 w-4" /> New Document
        </Button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No articles yet</p>
        ) : (
          articles.map((a: any) => (
            <Card key={a.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/documents/${a.id}`)}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.category || 'Uncategorized'} • {a.author?.full_name || '—'}</p>
                </div>
                {a.is_global && <Badge variant="outline" className="mr-1">{APP_NAME}</Badge>}
                <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>{a.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
