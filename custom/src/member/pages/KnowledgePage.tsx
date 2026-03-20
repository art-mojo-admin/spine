import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/button'
import { Search, BookOpen, FileText, MessageCircle, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KnowledgeArticle {
  id: string
  title: string
  description: string
  metadata: {
    article_kind: string
    visibility: string
    audience: string[]
    tags: string[]
    summary: string
  }
  stage: string
  created_at: string
  updated_at: string
}

const ARTICLE_KIND_ICONS: Record<string, React.ComponentType<any>> = {
  docs: FileText,
  faq: MessageCircle,
  troubleshooting: Zap,
  implementation: BookOpen,
  release_note: FileText,
  announcement: Users
}

const ARTICLE_KIND_LABELS: Record<string, string> = {
  docs: 'Documentation',
  faq: 'FAQ',
  troubleshooting: 'Troubleshooting',
  implementation: 'Implementation',
  release_note: 'Release Notes',
  announcement: 'Announcement'
}

export default function KnowledgePage() {
  const { currentAccountId, profile } = useAuth()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKind, setSelectedKind] = useState<string>('')
  const [selectedAudience, setSelectedAudience] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    loadArticles()
  }, [searchQuery, selectedKind, selectedAudience, selectedTags])

  const loadArticles = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (selectedKind) params.set('article_kind', selectedKind)
      if (selectedAudience) params.set('audience', selectedAudience)
      if (selectedTags.length > 0) params.set('tags', selectedTags.join(','))

      const response = await apiGet(`/custom/knowledge?mode=search&${params}`)
      setArticles(response)
    } catch (err) {
      console.error('Failed to load articles:', err)
    } finally {
      setLoading(false)
    }
  }

  const allTags = [...new Set(articles.flatMap(article => article.metadata.tags || []))]

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Find answers to your questions about Spine
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Article Kind Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <select
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Types</option>
                {Object.entries(ARTICLE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Audience Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Audience</label>
              <select
                value={selectedAudience}
                onChange={(e) => setSelectedAudience(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Audiences</option>
                <option value="developer">Developers</option>
                <option value="operator">Operators</option>
                <option value="customer">Customers</option>
                <option value="admin">Admins</option>
              </select>
            </div>

            {/* Tags Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag))
                      } else {
                        setSelectedTags([...selectedTags, tag])
                      }
                    }}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full border transition-colors",
                      selectedTags.includes(tag)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedKind || selectedAudience || selectedTags.length > 0) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedKind('')
                  setSelectedAudience('')
                  setSelectedTags([])
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Articles Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading articles...</div>
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedKind || selectedAudience || selectedTags.length > 0
                ? 'Try adjusting your search terms or filters'
                : 'No knowledge articles are available yet'
              }
            </p>
            {(searchQuery || selectedKind || selectedAudience || selectedTags.length > 0) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedKind('')
                  setSelectedAudience('')
                  setSelectedTags([])
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => {
            const IconComponent = ARTICLE_KIND_ICONS[article.metadata.article_kind] || FileText
            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">
                        {ARTICLE_KIND_LABELS[article.metadata.article_kind] || article.metadata.article_kind}
                      </Badge>
                    </div>
                    {article.stage === 'Published' && (
                      <Badge variant="default" className="text-xs">Published</Badge>
                    )}
                  </div>
                  <CardTitle className="text-base leading-tight">
                    <Link
                      to={`/member/knowledge/${article.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {article.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {article.metadata.summary || article.description}
                  </p>
                  
                  {/* Tags */}
                  {article.metadata.tags && article.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {article.metadata.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {article.metadata.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{article.metadata.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Audience badges */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      {article.metadata.audience?.slice(0, 2).map(audience => (
                        <Badge key={audience} variant="outline" className="text-xs">
                          {audience}
                        </Badge>
                      ))}
                    </div>
                    <span>
                      Updated {new Date(article.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
