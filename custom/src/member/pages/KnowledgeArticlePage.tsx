import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, BookOpen, FileText, MessageSquare, Users } from 'lucide-react'

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
    content: string
  }
  stage: string
  created_at: string
  updated_at: string
  created_by: string
  related_articles: Array<{
    id: string
    title: string
    description: string
  }>
  referenced_by_cases: Array<{
    id: string
    title: string
    metadata: any
    stage: string
  }>
}

const ARTICLE_KIND_ICONS = {
  docs: FileText,
  faq: MessageSquare,
  troubleshooting: FileText,
  implementation: BookOpen,
  release_note: FileText,
  announcement: Users
}

const ARTICLE_KIND_LABELS = {
  docs: 'Documentation',
  faq: 'FAQ',
  troubleshooting: 'Troubleshooting',
  implementation: 'Implementation',
  release_note: 'Release Notes',
  announcement: 'Announcement'
}

export default function KnowledgeArticlePage() {
  const { articleId } = useParams<{ articleId: string }>()
  const { currentAccountId } = useAuth()
  const [article, setArticle] = useState<KnowledgeArticle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (articleId) {
      loadArticle()
    }
  }, [articleId])

  const loadArticle = async () => {
    if (!articleId || !currentAccountId) return

    try {
      setLoading(true)
      const response = await apiGet(`/custom/knowledge?mode=detail&item_id=${articleId}`)
      setArticle(response)
    } catch (err) {
      console.error('Failed to load article:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Loading article...</div>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Article not found</div>
        </div>
      </div>
    )
  }

  const IconComponent = ARTICLE_KIND_ICONS[article.metadata.article_kind] || FileText

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link to="/member/knowledge" className="text-primary hover:underline mb-2 block">
          ← Back to Knowledge Base
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <IconComponent className="h-6 w-6 text-muted-foreground" />
          <Badge variant="secondary">
            {ARTICLE_KIND_LABELS[article.metadata.article_kind] || article.metadata.article_kind}
          </Badge>
          {article.stage === 'Published' && (
            <Badge variant="default">Published</Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
        <p className="text-lg text-muted-foreground">{article.metadata.summary}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-8">
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: article.metadata.content }} />
              </div>
            </CardContent>
          </Card>

          {/* Related Articles */}
          {article.related_articles.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Related Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {article.related_articles.map(related => (
                    <Link
                      key={related.id}
                      to={`/member/knowledge/${related.id}`}
                      className="block p-3 border rounded hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">{related.title}</div>
                      <div className="text-sm text-muted-foreground">{related.description}</div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Type</div>
                <Badge variant="outline">
                  {ARTICLE_KIND_LABELS[article.metadata.article_kind] || article.metadata.article_kind}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Visibility</div>
                <Badge variant="outline">{article.metadata.visibility}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Audience</div>
                <div className="flex flex-wrap gap-1">
                  {article.metadata.audience.map(audience => (
                    <Badge key={audience} variant="outline" className="text-xs">
                      {audience}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {article.metadata.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div>{new Date(article.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Updated</div>
                <div>{new Date(article.updated_at).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>

          {/* Support Cases */}
          {article.referenced_by_cases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Used in Support Cases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {article.referenced_by_cases.slice(0, 3).map(case_ => (
                    <div key={case_.id} className="p-2 border rounded">
                      <div className="font-medium text-sm">{case_.title}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {case_.stage}
                      </Badge>
                    </div>
                  ))}
                  {article.referenced_by_cases.length > 3 && (
                    <div className="text-sm text-muted-foreground">
                      +{article.referenced_by_cases.length - 3} more cases
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
