import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet, apiPost } from './lib/api'
import { useAuth } from './hooks/useAuth'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { MessageSquare, Send, ArrowLeft, Users, Megaphone, HelpCircle, Pin } from 'lucide-react'
import { cn } from './lib/utils'

interface CommunityPost {
  id: string
  title: string
  description: string
  metadata: {
    post_kind: string
    category: string
    tags: string[]
    pinned: boolean
    moderation_status: string
  }
  stage: string
  created_at: string
  updated_at: string
  created_by: string
  creator: {
    full_name: string
    email: string
  }
  thread: {
    id: string
    messages: Array<{
      content: string
      direction: string
      created_at: string
      created_by?: string
      persons?: {
        full_name: string
        email: string
      }
    }>
  } | null
  linked_articles: Array<{
    id: string
    title: string
    description: string
    metadata: any
  }>
  can_edit: boolean
}

const POST_KIND_ICONS: Record<string, React.ComponentType<any>> = {
  announcement: Megaphone,
  discussion: Users,
  question: HelpCircle
}

const POST_KIND_LABELS: Record<string, string> = {
  announcement: 'Announcement',
  discussion: 'Discussion',
  question: 'Question'
}

export default function CommunityPostPage() {
  const { postId } = useParams<{ postId: string }>()
  const { currentAccountId, profile } = useAuth()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [newReply, setNewReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (postId) {
      loadPost()
    }
  }, [postId])

  const loadPost = async () => {
    if (!postId || !currentAccountId) return

    try {
      setLoading(true)
      const response = await apiGet(`/custom/community?mode=detail&item_id=${postId}`)
      setPost(response)
    } catch (err) {
      console.error('Failed to load post:', err)
    } finally {
      setLoading(false)
    }
  }

  const sendReply = async () => {
    if (!newReply.trim() || !postId || !currentAccountId) return

    try {
      setSending(true)
      await apiPost(`/custom/community/${postId}/reply`, {
        content: newReply
      })
      
      setNewReply('')
      await loadPost()
    } catch (err) {
      console.error('Failed to send reply:', err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Loading post...</div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Post not found</div>
        </div>
      </div>
    )
  }

  const IconComponent = POST_KIND_ICONS[post.metadata.post_kind] || MessageSquare

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link to="/customer-portal/community" className="text-primary hover:underline mb-2 block">
          ← Back to Community
        </Link>
        <div className="flex items-center gap-2 mb-4">
          {post.metadata.pinned && <Pin className="h-4 w-4 text-primary" />}
          <IconComponent className="h-5 w-5 text-muted-foreground" />
          <Badge variant="secondary">
            {POST_KIND_LABELS[post.metadata.post_kind] || post.metadata.post_kind}
          </Badge>
          <Badge variant="outline">{post.metadata.category}</Badge>
        </div>
        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>By {post.creator.full_name}</span>
          <span>•</span>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
          {post.updated_at !== post.created_at && (
            <>
              <span>•</span>
              <span>Updated {new Date(post.updated_at).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Post Content */}
          <Card>
            <CardContent className="p-6">
              <div className="prose max-w-none">
                <p>{post.description}</p>
              </div>
              
              {/* Tags */}
              {post.metadata.tags && post.metadata.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.metadata.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Articles */}
          {post.linked_articles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Related Knowledge Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {post.linked_articles.map(article => (
                    <Link
                      key={article.id}
                      to={`/customer-portal/knowledge/${article.id}`}}
                      className="block p-3 border rounded hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">{article.title}</div>
                      <div className="text-sm text-muted-foreground">{article.description}</div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discussion Thread */}
          <Card>
            <CardHeader>
              <CardTitle>Discussion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {post.thread?.messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.direction === 'inbound' ? "flex-row" : "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs bg-primary text-primary-foreground"
                    )}>
                      {message.persons?.full_name?.[0] || 'U'}
                    </div>
                    <div className="max-w-md">
                      {message.persons && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {message.persons.full_name}
                        </div>
                      )}
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(message.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Input */}
              <div className="mt-4 flex gap-2">
                <Textarea
                  placeholder="Write a reply..."
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  rows={3}
                  className="flex-1"
                />
                <Button onClick={sendReply} disabled={sending || !newReply.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Post Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Post Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Type</div>
                <Badge variant="outline">
                  {POST_KIND_LABELS[post.metadata.post_kind] || post.metadata.post_kind}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Category</div>
                <Badge variant="outline">{post.metadata.category}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge variant="outline">{post.metadata.moderation_status}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div>{new Date(post.created_at).toLocaleString()}</div>
              </div>
              {post.updated_at !== post.created_at && (
                <div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                  <div>{new Date(post.updated_at).toLocaleString()}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Author Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Author</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-medium">{post.creator.full_name}</div>
                <div className="text-sm text-muted-foreground">{post.creator.email}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
