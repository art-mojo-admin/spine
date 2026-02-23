import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { EditableField } from '@/components/shared/EditableField'
import { CustomFieldsRenderer } from '@/components/shared/CustomFieldsRenderer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Save, X, BookOpen } from 'lucide-react'
import { APP_NAME } from '@/lib/config'

const KB_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

export function KBArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const { currentAccountId, profile } = useAuth()
  const isNew = articleId === 'new'

  const [article, setArticle] = useState<any>(null)
  const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('draft')
  const [metadata, setMetadata] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!currentAccountId || isNew || !articleId) return

    setLoading(true)
    apiGet<any>('kb-articles', { id: articleId })
      .then((res) => {
        setArticle(res)
        setTitle(res.title || '')
        setSlug(res.slug || '')
        setBody(res.body || '')
        setCategory(res.category || '')
        setStatus(res.status || 'draft')
        setMetadata(res.metadata || {})
      })
      .catch((err: any) => setErrorMessage(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [currentAccountId, articleId, isNew])

  function resetDraft() {
    if (article) {
      setTitle(article.title || '')
      setSlug(article.slug || '')
      setBody(article.body || '')
      setCategory(article.category || '')
      setStatus(article.status || 'draft')
      setMetadata(article.metadata || {})
    }
    setEditing(false)
  }

  async function handleSave() {
    if (!title.trim()) {
      setErrorMessage('Title is required.')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      if (isNew) {
        const created = await apiPost<any>('kb-articles', {
          title,
          slug: slug || undefined,
          body,
          category: category || undefined,
          status,
        })
        navigate(`/kb/${created.id}`, { replace: true })
      } else {
        const updated = await apiPatch<any>('kb-articles', {
          title,
          slug: slug || undefined,
          body,
          category: category || undefined,
          status,
          metadata,
        }, { id: articleId! })
        setArticle(updated)
        setEditing(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">KB Article</h1>
        </div>
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Article' : 'KB Article'}
          </h1>
        </div>
        {!isNew && !editing && (!article?.is_global || profile?.system_role === 'system_admin') && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />Edit
          </Button>
        )}
      </div>

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              {editing ? (
                <span className="text-lg font-semibold">{title || 'Untitled Article'}</span>
              ) : (
                <>
                  <p className="text-lg font-semibold">{article?.title}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {article?.is_global && <Badge variant="outline">{APP_NAME}</Badge>}
                    <Badge variant={article?.status === 'published' ? 'default' : 'secondary'}>{article?.status}</Badge>
                    {article?.category && <span>{article.category}</span>}
                  </div>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField label="Title" value={title} editing={editing} onChange={setTitle} required placeholder="Article title" />
            <EditableField label="Slug" value={slug} editing={editing} onChange={setSlug} placeholder="url-slug" />
            <EditableField label="Status" value={status} editing={editing} onChange={setStatus} type="select" options={KB_STATUSES} />
            <EditableField label="Category" value={category} editing={editing} onChange={setCategory} placeholder="e.g. getting-started" />
          </div>
          <div className="mt-4">
            <EditableField label="Body" value={body} editing={editing} onChange={setBody} type="richtext" placeholder="Write article content..." />
          </div>

          {!isNew && !editing && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Author</dt>
                <dd>{article?.author?.full_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Published</dt>
                <dd>{article?.published_at ? new Date(article.published_at).toLocaleString() : 'Not published'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{article?.created_at ? new Date(article.created_at).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Article ID</dt>
                <dd className="font-mono text-xs break-all">{article?.id}</dd>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isNew && (
        <CustomFieldsRenderer
          entityType="kb_article"
          metadata={metadata}
          editing={editing}
          onChange={setMetadata}
        />
      )}

      {editing && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
          </Button>
          {!isNew && (
            <Button variant="ghost" onClick={resetDraft}>
              <X className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
