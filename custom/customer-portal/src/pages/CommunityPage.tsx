import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from './lib/api'
import { useAuth } from './hooks/useAuth'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { MessageSquare, Plus, Megaphone, HelpCircle, Users, Pin } from 'lucide-react'
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

export default function CommunityPage() {
  const { currentAccountId, profile } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedKind, setSelectedKind] = useState<string>('')

  // New post form
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    post_kind: 'discussion',
    category: 'general',
    tags: []
  })

  useEffect(() => {
    loadPosts()
  }, [selectedKind])

  const loadPosts = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedKind) params.set('post_kind', selectedKind)
      
      const response = await apiGet(`/custom/community?mode=list&${params}`)
      setPosts(response)
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentAccountId || !newPost.title || !newPost.content || !newPost.post_kind) return

    try {
      setSubmitting(true)
      await apiPost('/custom/community', newPost)
      
      // Reset form
      setNewPost({
        title: '',
        content: '',
        post_kind: 'discussion',
        category: 'general',
        tags: []
      })
      setShowNewPost(false)
      
      // Reload posts
      await loadPosts()
    } catch (err) {
      console.error('Failed to create post:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Community</h1>
        <p className="text-muted-foreground">
          Connect with other Spine users, ask questions, and share experiences
        </p>
      </div>

      {/* Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by type:</label>
            <div className="flex gap-2">
              <Button
                variant={selectedKind === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedKind('')}
              >
                All
              </Button>
              {Object.entries(POST_KIND_LABELS).map(([value, label]) => (
                <Button
                  key={value}
                  variant={selectedKind === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedKind(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Post Form */}
      {showNewPost ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Post</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPost} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="What's on your mind?"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Content</label>
                <Textarea
                  placeholder="Share your thoughts, questions, or experiences..."
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <Select value={newPost.post_kind} onValueChange={(value) => setNewPost({ ...newPost, post_kind: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="announcement">Announcement</SelectItem>
                      <SelectItem value="discussion">Discussion</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={newPost.category} onValueChange={(value) => setNewPost({ ...newPost, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="showcase">Showcase</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="help">Help Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Posting...' : 'Post'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewPost(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowNewPost(true)} className="mb-6">
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      )}

      {/* Posts List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading posts...</div>
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-4">
              Be the first to start a conversation in the community
            </p>
            <Button onClick={() => setShowNewPost(true)}>
              Create First Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const IconComponent = POST_KIND_ICONS[post.metadata.post_kind] || MessageSquare
            return (
              <Card key={post.id} className={cn(
                "hover:shadow-md transition-shadow",
                post.metadata.pinned && "border-l-4 border-l-primary"
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {post.metadata.pinned && <Pin className="h-4 w-4 text-primary" />}
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">
                          {POST_KIND_LABELS[post.metadata.post_kind] || post.metadata.post_kind}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {post.metadata.category}
                        </Badge>
                      </div>
                      <CardTitle className="text-base leading-tight">
                        <Link
                          to={`/customer-portal/community/${post.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {post.title}
                        </Link>
                      </CardTitle>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="font-medium">{post.creator.full_name}</div>
                      <div>{new Date(post.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {post.description}
                  </p>
                  
                  {/* Tags */}
                  {post.metadata.tags && post.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {post.metadata.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {post.metadata.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{post.metadata.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Link
                      to={`/member/community/${post.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View Discussion →
                    </Link>
                    {post.metadata.moderation_status !== 'active' && (
                      <Badge variant="secondary" className="text-xs">
                        {post.metadata.moderation_status.replace(/_/g, ' ')}
                      </Badge>
                    )}
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
