import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Send, Trash2 } from 'lucide-react'

interface EntityCommentsPanelProps {
  entityType: string
  entityId: string
}

interface Comment {
  id: string
  person_id: string | null
  role: string
  body: string
  is_internal: boolean
  metadata: Record<string, any>
  created_at: string
  person?: { id: string; full_name: string } | null
}

export function EntityCommentsPanel({ entityType, entityId }: EntityCommentsPanelProps) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setLoading(true)
    apiGet<Comment[]>('entity-comments', { entity_type: entityType, entity_id: entityId })
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  async function handleSend() {
    if (!newComment.trim()) return
    setSending(true)
    try {
      const created = await apiPost<Comment>('entity-comments', {
        entity_type: entityType,
        entity_id: entityId,
        body: newComment,
      })
      setComments((prev) => [...prev, created])
      setNewComment('')
    } catch {
      // Silently fail — user can retry
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete('entity-comments', { id })
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // Silently fail
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">No comments yet</p>
        ) : (
          <div className="space-y-3 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {comment.person?.full_name || 'System'}
                    </span>
                    {comment.role !== 'user' && (
                      <Badge variant="outline" className="text-[10px]">{comment.role}</Badge>
                    )}
                    {comment.is_internal && (
                      <Badge variant="secondary" className="text-[10px]">Internal</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                    {comment.person_id === profile?.person_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleDelete(comment.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment... (⌘+Enter to send)"
            className="flex-1"
          />
          <Button
            size="sm"
            disabled={!newComment.trim() || sending}
            onClick={handleSend}
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
