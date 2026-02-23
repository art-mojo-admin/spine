import { useState } from 'react'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search as SearchIcon, FileText, GitBranch, TicketCheck } from 'lucide-react'

const ENTITY_ICONS: Record<string, any> = {
  ticket: TicketCheck,
  kb_article: FileText,
  workflow_item: GitBranch,
}

export function SearchPage() {
  const { currentAccountId } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [entityFilter, setEntityFilter] = useState('')

  async function handleSearch() {
    if (!query.trim() || !currentAccountId) return
    setLoading(true)
    setSearched(true)
    try {
      const params: any = { query, limit: 20 }
      if (entityFilter) params.entity_type = entityFilter
      const data = await apiPost<any[]>('embeddings?action=search', params)
      setResults(data)
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="mt-1 text-muted-foreground">Semantic search across all indexed content</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex gap-3">
            <Input
              placeholder="Search tickets, articles, workflow items..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <select
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="ticket">Tickets</option>
              <option value="kb_article">KB Articles</option>
              <option value="workflow_item">Workflow Items</option>
            </select>
            <Button onClick={handleSearch} disabled={loading}>
              <SearchIcon className="mr-2 h-4 w-4" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searched && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>
          {results.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No matching content found. Content is indexed when created or updated.</p>
              </CardContent>
            </Card>
          ) : (
            results.map((result: any) => {
              const Icon = ENTITY_ICONS[result.entity_type] || FileText
              return (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {result.metadata?.title || result.metadata?.subject || `${result.entity_type}/${result.entity_id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {result.entity_type} • {result.vector_type}
                        {result.similarity !== undefined && ` • ${(result.similarity * 100).toFixed(1)}% match`}
                      </p>
                    </div>
                    <Badge variant="secondary">{result.entity_type}</Badge>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
