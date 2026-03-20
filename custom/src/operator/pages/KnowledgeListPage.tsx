import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, MessageCircle, BookOpen, Users, Zap, Search, Eye, Edit, Send, Archive, Plus } from 'lucide-react'
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
  created_by: string
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

export default function KnowledgeListPage() {
  const { currentAccountId, profile } = useAuth()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState<string>('')
  const [filterKind, setFilterKind] = useState<string>('')
  const [filterVisibility, setFilterVisibility] = useState<string>('')
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<string>('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadArticles()
  }, [searchQuery, filterStage, filterKind, filterVisibility])

  const loadArticles = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (filterStage) params.set('stage', filterStage)
      if (filterKind) params.set('article_kind', filterKind)
      if (filterVisibility) params.set('visibility', filterVisibility)
      
      const response = await apiGet(`/custom/knowledge?mode=search&${params}`)
      setArticles(response)
    } catch (err) {
      console.error('Failed to load articles:', err)
    } finally {
      setLoading(false)
    }
  }

  const publishArticle = async (articleId: string) => {
    try {
      setProcessing(true)
      await apiPatch(`/custom/knowledge/${articleId}`, { stage: 'Published' })
      await loadArticles()
    } catch (err) {
      console.error('Failed to publish article:', err)
    } finally {
      setProcessing(false)
    }
  }

  const archiveArticle = async (articleId: string) => {
    try {
      setProcessing(true)
      await apiPatch(`/custom/knowledge/${articleId}`, { stage: 'Archived' })
      await loadArticles()
    } catch (err) {
      console.error('Failed to archive article:', err)
    } finally {
      setProcessing(false)
    }
  }

  const executeBulkAction = async () => {
    if (!bulkAction || selectedArticles.length === 0) return

    try {
      setProcessing(true)
      
      for (const articleId of selectedArticles) {
        if (bulkAction === 'publish') {
          await apiPatch(`/custom/knowledge/${articleId}`, { stage: 'Published' })
        } else if (bulkAction === 'archive') {
          await apiPatch(`/custom/knowledge/${articleId}`, { stage: 'Archived' })
        }
      }
      
      setSelectedArticles([])
      setBulkAction('')
      await loadArticles()
    } catch (err) {
      console.error('Failed to execute bulk action:', err)
    } finally {
      setProcessing(false)
    }
  }

  const toggleArticleSelection = (articleId: string) => {
    if (selectedArticles.includes(articleId)) {
      setSelectedArticles(selectedArticles.filter(id => id !== articleId))
    } else {
      setSelectedArticles([...selectedArticles, articleId])
    }
  }

  const selectAll = () => {
    if (selectedArticles.length === articles.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(articles.map(a => a.id))
    }
  }

  const filteredArticles = articles.filter(article => {
    if (searchQuery && !article.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !article.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  const stats = {
    total: articles.length,
    draft: articles.filter(a => a.stage === 'Draft').length,
    review: articles.filter(a => a.stage === 'Review').length,
    published: articles.filter(a => a.stage === 'Published').length,
    archived: articles.filter(a => a.stage === 'Archived').length
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Knowledge Management</h1>
            <p className="text-muted-foreground">
              Manage knowledge articles and documentation
            </p>
          </div>
          <Link to="/operator/knowledge/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            <div className="text-sm text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.review}</div>
            <div className="text-sm text-muted-foreground">Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
            <div className="text-sm text-muted-foreground">Published</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.archived}</div>
            <div className="text-sm text-muted-foreground">Archived</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Stages</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Review">Review</SelectItem>
                <SelectItem value="Published">Published</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {Object.entries(ARTICLE_KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Filter by visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Visibility</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedArticles.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm">
                  {selectedArticles.length} article{selectedArticles.length !== 1 ? 's' : ''} selected
                </span>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selectedArticles.length === articles.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Bulk action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publish">Publish</SelectItem>
                    <SelectItem value="archive">Archive</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={executeBulkAction}
                  disabled={!bulkAction || processing}
                  size="sm"
                >
                  {processing ? 'Processing...' : 'Execute'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Articles List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading articles...</div>
        </div>
      ) : filteredArticles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterStage || filterKind || filterVisibility
                ? 'Try adjusting your filters'
                : 'No knowledge articles available yet'
              }
            </p>
            {(searchQuery || filterStage || filterKind || filterVisibility) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setFilterStage('')
                  setFilterKind('')
                  setFilterVisibility('')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => {
            const IconComponent = ARTICLE_KIND_ICONS[article.metadata.article_kind] || FileText
            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedArticles.includes(article.id)}
                      onChange={() => toggleArticleSelection(article.id)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        <Link
                          to={`/operator/knowledge/${article.id}`}
                          className="font-medium hover:text-primary transition-colors text-lg"
                        >
                          {article.title}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {ARTICLE_KIND_LABELS[article.metadata.article_kind] || article.metadata.article_kind}
                        </Badge>
                        <Badge 
                          variant={article.stage === 'Published' ? 'default' : 
                                   article.stage === 'Archived' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {article.stage}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {article.metadata.visibility}
                        </Badge>
                      </div>
                      
                      <p className="text-muted-foreground mb-3 line-clamp-2">
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

                      {/* Audience */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {article.metadata.audience?.slice(0, 2).map(audience => (
                            <Badge key={audience} variant="outline" className="text-xs">
                              {audience}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
                          <div className="flex gap-1">
                            {article.stage === 'Draft' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => publishArticle(article.id)}
                                disabled={processing}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Publish
                              </Button>
                            )}
                            {(article.stage === 'Draft' || article.stage === 'Review') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => archiveArticle(article.id)}
                                disabled={processing}
                              >
                                <Archive className="h-3 w-3 mr-1" />
                                Archive
                              </Button>
                            )}
                            <Link to={`/operator/knowledge/${article.id}`}>
                              <Button size="sm" variant="outline">
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </Link>
                            <Link to={`/member/knowledge/${article.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
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
