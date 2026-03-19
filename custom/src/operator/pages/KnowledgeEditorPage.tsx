import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Eye, FileText } from 'lucide-react'

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
}

export default function KnowledgeEditorPage() {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const { currentAccountId, profile } = useAuth()
  const [article, setArticle] = useState<KnowledgeArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(!articleId) // New article if no ID

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    article_kind: 'faq',
    visibility: 'member',
    audience: ['customer'],
    tags: [],
    stage: 'Draft'
  })

  useEffect(() => {
    if (articleId) {
      loadArticle()
    } else {
      setLoading(false)
      setIsEditing(true)
    }
  }, [articleId])

  const loadArticle = async () => {
    if (!articleId || !currentAccountId) return

    try {
      setLoading(true)
      const response = await apiGet(`/custom/knowledge?mode=detail&item_id=${articleId}`)
      setArticle(response)
      
      // Set form data from article
      setFormData({
        title: response.title,
        summary: response.metadata.summary || response.description,
        content: response.metadata.content || '',
        article_kind: response.metadata.article_kind,
        visibility: response.metadata.visibility,
        audience: response.metadata.audience || ['customer'],
        tags: response.metadata.tags || [],
        stage: response.stage
      })
    } catch (err) {
      console.error('Failed to load article:', err)
    } finally {
      setLoading(false)
    }
  }

  const saveArticle = async () => {
    if (!currentAccountId) return

    try {
      setSaving(true)
      
      const payload = {
        title: formData.title,
        summary: formData.summary,
        content: formData.content,
        article_kind: formData.article_kind,
        visibility: formData.visibility,
        audience: formData.audience,
        tags: formData.tags,
        stage: formData.stage
      }

      if (articleId) {
        await apiPatch(`/custom/knowledge/${articleId}`, payload)
      } else {
        const response = await apiPost('/custom/knowledge', payload)
        navigate(`/operator/knowledge/${response.id}`)
      }
      
      await loadArticle()
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to save article:', err)
    } finally {
      setSaving(false)
    }
  }

  const publishArticle = async () => {
    if (!currentAccountId || !articleId) return

    try {
      setSaving(true)
      await apiPatch(`/custom/knowledge/${articleId}`, { stage: 'Published' })
      await loadArticle()
    } catch (err) {
      console.error('Failed to publish article:', err)
    } finally {
      setSaving(false)
    }
  }

  const archiveArticle = async () => {
    if (!currentAccountId || !articleId) return

    try {
      setSaving(true)
      await apiPatch(`/custom/knowledge/${articleId}`, { stage: 'Archived' })
      await loadArticle()
    } catch (err) {
      console.error('Failed to archive article:', err)
    } finally {
      setSaving(false)
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

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/operator/knowledge" className="text-primary hover:underline">
              ← Back to Knowledge Management
            </Link>
            {article && (
              <Link to={`/member/knowledge/${articleId}`} target="_blank">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View as Member
                </Button>
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <Button onClick={saveArticle} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                {article?.stage === 'Draft' && (
                  <Button onClick={publishArticle} disabled={saving}>
                    Publish
                  </Button>
                )}
                {article?.stage === 'Published' && (
                  <Button variant="outline" onClick={archiveArticle} disabled={saving}>
                    Archive
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? 'Edit Article' : article?.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Article title"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Summary</label>
                    <Textarea
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      placeholder="Brief summary"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Content</label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Full article content (HTML supported)"
                      rows={12}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h1 className="text-2xl font-bold mb-4">{article?.title}</h1>
                    <div className="prose max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: formData.content }} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Article Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Article Type</label>
                    <Select value={formData.article_kind} onValueChange={(value) => setFormData({ ...formData, article_kind: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="docs">Documentation</SelectItem>
                        <SelectItem value="faq">FAQ</SelectItem>
                        <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                        <SelectItem value="implementation">Implementation</SelectItem>
                        <SelectItem value="release_note">Release Note</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Visibility</label>
                    <Select value={formData.visibility} onValueChange={(value) => setFormData({ ...formData, visibility: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="operator">Operator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Audience</label>
                    <div className="space-y-2">
                      {['customer', 'developer', 'operator', 'admin'].map(audience => (
                        <label key={audience} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.audience.includes(audience)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, audience: [...formData.audience, audience] })
                              } else {
                                setFormData({ ...formData, audience: formData.audience.filter(a => a !== audience) })
                              }
                            }}
                          />
                          <span className="text-sm">{audience}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Stage</label>
                    <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Review">Review</SelectItem>
                        <SelectItem value="Published">Published</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground">Type</div>
                    <Badge variant="outline">{formData.article_kind}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Visibility</div>
                    <Badge variant="outline">{formData.visibility}</Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Stage</div>
                    <Badge variant={article?.stage === 'Published' ? 'default' : 'secondary'}>
                      {article?.stage}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Audience</div>
                    <div className="flex flex-wrap gap-1">
                      {formData.audience.map(audience => (
                        <Badge key={audience} variant="outline" className="text-xs">
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          {article && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div>{new Date(article.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                  <div>{new Date(article.updated_at).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
