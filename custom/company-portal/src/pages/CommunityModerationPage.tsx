import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Users, MessageSquare, Megaphone, HelpCircle, AlertTriangle, CheckCircle, Eye, Archive, Ban } from 'lucide-react'
import { cn } from '../lib/utils'

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
    moderation_reason?: string
    moderation_action?: string
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

export default function CommunityModerationPage() {
  const { currentAccountId, profile } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [processing, setProcessing] = useState(false)
  const [selectedPost, setSelectedPost] = useState<string | null>(null)

  useEffect(() => {
    loadPosts()
  }, [filterStatus])

  const loadPosts = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStatus && filterStatus !== 'all') params.set('moderation_status', filterStatus)
      
      const response = await apiGet(`/custom/community?mode=moderation-queue&${params}`)
      setPosts(response)
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const moderatePost = async (postId: string, action: string, reason?: string) => {
    try {
      setProcessing(true)
      await apiPatch(`/custom/community/${postId}`, {
        moderation_status: action === 'dismiss' ? 'active' : action,
        moderation_reason: reason,
        moderation_action: action
      })
      
      await loadPosts()
      setSelectedPost(null)
    } catch (err) {
      console.error('Failed to moderate post:', err)
    } finally {
      setProcessing(false)
    }
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'Active': return <CheckCircle className="h-4 w-4" />
      case 'Reported': return <AlertTriangle className="h-4 w-4" />
      case 'Under Review': return <Eye className="h-4 w-4" />
      case 'Action Taken': return <Ban className="h-4 w-4" />
      case 'Dismissed': return <Archive className="h-4 w-4" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Active': return 'default'
      case 'Reported': return 'destructive'
      case 'Under Review': return 'secondary'
      case 'Action Taken': return 'destructive'
      case 'Dismissed': return 'secondary'
      default: return 'secondary'
    }
  }

  const stats = {
    total: posts.length,
    reported: posts.filter(p => p.metadata.moderation_status === 'reported').length,
    underReview: posts.filter(p => p.metadata.moderation_status === 'under_review').length,
    actionTaken: posts.filter(p => p.metadata.moderation_status === 'action_taken').length,
    dismissed: posts.filter(p => p.metadata.moderation_status === 'dismissed').length
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Community Moderation</h1>
        <p className="text-muted-foreground">
          Review and moderate community posts and discussions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Posts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.reported}</div>
            <div className="text-sm text-muted-foreground">Reported</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.underReview}</div>
            <div className="text-sm text-muted-foreground">Under Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.actionTaken}</div>
            <div className="text-sm text-muted-foreground">Action Taken</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.dismissed}</div>
            <div className="text-sm text-muted-foreground">Dismissed</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by status:</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="action_taken">Action Taken</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading posts...</div>
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts found</h3>
            <p className="text-muted-foreground mb-4">
              {filterStatus ? 'Try adjusting your filters' : 'No posts require moderation'}
            </p>
            {filterStatus && (
              <Button
                variant="outline"
                onClick={() => setFilterStatus('all')}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const IconComponent = POST_KIND_ICONS[post.metadata.post_kind] || MessageSquare
            return (
              <Card key={post.id} className={cn(
                "hover:shadow-md transition-shadow",
                selectedPost === post.id && "ring-2 ring-primary"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {post.metadata.pinned && <div className="w-2 h-2 bg-primary rounded-full" />}
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        <Link
                          to={`/member/community/${post.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {post.title}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {POST_KIND_LABELS[post.metadata.post_kind] || post.metadata.post_kind}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {post.metadata.category}
                        </Badge>
                        <Badge variant={getStageColor(post.metadata.moderation_status)} className="text-xs">
                          {post.metadata.moderation_status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-2 line-clamp-2">
                        {post.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>By: {post.creator.full_name}</span>
                        <span>•</span>
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                        {post.metadata.moderation_reason && (
                          <>
                            <span>•</span>
                            <span className="text-red-600">{post.metadata.moderation_reason}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Link to={`/member/community/${post.id}`} target="_blank">
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </Link>
                      
                      {post.metadata.moderation_status === 'reported' && (
                        <Button
                          size="sm"
                          onClick={() => moderatePost(post.id, 'under_review')}
                          disabled={processing}
                        >
                          Review
                        </Button>
                      )}
                      
                      {post.metadata.moderation_status === 'under_review' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moderatePost(post.id, 'dismiss')}
                            disabled={processing}
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => moderatePost(post.id, 'action_taken', 'Inappropriate content')}
                            disabled={processing}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {post.metadata.tags && post.metadata.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
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
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
