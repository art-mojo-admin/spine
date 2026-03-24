import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Separator } from '../components/ui/separator'
import { MessageSquare, Bot, Send, FileText, CheckCircle, Clock, AlertCircle, User, ArrowRight } from 'lucide-react'
import { cn } from '../lib/utils'
import { FormRenderer, type ItemTypeSchema } from '../components/ui/FieldRenderer'

interface SupportCase {
  id: string
  title: string
  description: string
  metadata: {
    priority: string
    ai_confidence_score?: number
    escalation_reason?: string
    ai_summary?: string
    resolution_kind?: string
    resolution_notes?: string
  }
  stage: string
  created_at: string
  updated_at: string
  created_by: string
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
      metadata?: {
        ai_generated?: boolean
        confidence_score?: number
        escalated?: boolean
        used_articles?: string[]
      }
    }>
  } | null
  referenced_articles: Array<{
    id: string
    title: string
    description: string
    metadata: any
  }>
  resulted_in_articles: Array<{
    id: string
    title: string
    description: string
    metadata: any
    stage: string
  }>
}

export default function CaseWorkspacePage() {
  const { caseId } = useParams<{ caseId: string }>()
  const { currentAccountId, profile } = useAuth()
  const [caseDetail, setCaseDetail] = useState<SupportCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [kbSuggestions, setKbSuggestions] = useState<any>(null)
  const [showKBImprovement, setShowKBImprovement] = useState(false)
  const [kbAction, setKbAction] = useState<'create_draft' | 'update_existing'>('create_draft')
  const [selectedArticle, setSelectedArticle] = useState<string>('')
  const [schema, setSchema] = useState<ItemTypeSchema | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(true)

  // KB improvement form
  const [kbForm, setKbForm] = useState({
    title: '',
    content: '',
    summary: '',
    article_kind: 'faq',
    tags: [] as string[],
    audience: ['customer'] as string[],
    resolution_kind: 'internal_followup',
    resolution_notes: ''
  })

  useEffect(() => {
    if (caseId) {
      loadCase()
      loadKBSuggestions()
    }
  }, [caseId])

  const loadCase = async () => {
    if (!caseId || !currentAccountId) return

    try {
      setLoading(true)
      const response = await apiGet(`/custom/support?mode=detail&item_id=${caseId}`)
      setCaseDetail(response)
    } catch (err) {
      console.error('Failed to load case:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadKBSuggestions = async () => {
    if (!caseId || !currentAccountId) return

    try {
      const response = await apiGet(`/custom/kb-improvement?case_id=${caseId}`)
      setKbSuggestions(response)
      
      // Pre-fill form with suggestions
      if (response.suggested_title) {
        setKbForm(prev => ({ ...prev, title: response.suggested_title }))
      }
      if (response.suggested_summary) {
        setKbForm(prev => ({ ...prev, summary: response.suggested_summary }))
      }
      if (response.suggested_content) {
        setKbForm(prev => ({ ...prev, content: response.suggested_content }))
      }
      if (response.suggested_article_kind) {
        setKbForm(prev => ({ ...prev, article_kind: response.suggested_article_kind }))
      }
      if (response.suggested_tags) {
        setKbForm(prev => ({ ...prev, tags: response.suggested_tags }))
      }
      if (response.suggested_audience) {
        setKbForm(prev => ({ ...prev, audience: response.suggested_audience }))
      }
    } catch (err) {
      console.error('Failed to load KB suggestions:', err)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !caseId || !currentAccountId) return

    try {
      setSending(true)
      await apiPost(`/custom/support/${caseId}/message`, {
        content: newMessage,
        direction: 'outbound'
      })
      
      setNewMessage('')
      await loadCase()
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const updateCaseStage = async (stage: string) => {
    if (!caseId || !currentAccountId) return

    try {
      setUpdating(true)
      await apiPatch(`/custom/support/${caseId}`, { stage })
      await loadCase()
    } catch (err) {
      console.error('Failed to update case:', err)
    } finally {
      setUpdating(false)
    }
  }

  const resolveCase = async () => {
    if (!caseId || !currentAccountId) return

    try {
      setUpdating(true)
      await apiPatch(`/custom/support/${caseId}`, {
        stage: 'Resolved',
        resolution_kind: kbForm.resolution_kind || 'internal_followup',
        resolution_notes: kbForm.resolution_notes || ''
      })
      await loadCase()
    } catch (err) {
      console.error('Failed to resolve case:', err)
    } finally {
      setUpdating(false)
    }
  }

  const createKBFromCase = async () => {
    if (!caseId || !currentAccountId) return

    try {
      setUpdating(true)
      const payload = {
        case_id: caseId,
        action: kbAction,
        target_article_id: kbAction === 'update_existing' ? selectedArticle : undefined,
        title: kbForm.title,
        content: kbForm.content,
        summary: kbForm.summary,
        article_kind: kbForm.article_kind,
        tags: kbForm.tags,
        audience: kbForm.audience
      }

      await apiPost('/custom/kb-improvement', payload)
      
      setShowKBImprovement(false)
      await loadCase()
      await loadKBSuggestions()
    } catch (err) {
      console.error('Failed to create KB content:', err)
    } finally {
      setUpdating(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'Open': return <MessageSquare className="h-4 w-4" />
      case 'AI Attempt': return <Bot className="h-4 w-4" />
      case 'Escalated': return <AlertCircle className="h-4 w-4" />
      case 'In Progress': return <Clock className="h-4 w-4" />
      case 'Resolved': return <CheckCircle className="h-4 w-4" />
      case 'Closed': return <CheckCircle className="h-4 w-4" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Loading case...</div>
        </div>
      </div>
    )
  }

  if (!caseDetail) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Case not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link to="/company-portal/queue" className="text-primary hover:underline mb-2 block">
          ← Back to Queue
        </Link>
        <h1 className="text-3xl font-bold">{caseDetail.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Case Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStageIcon(caseDetail.stage)}
                  <Badge variant="outline">{caseDetail.stage}</Badge>
                  <Badge variant={getPriorityColor(caseDetail.metadata.priority)}>
                    {caseDetail.metadata.priority}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {caseDetail.stage !== 'Resolved' && caseDetail.stage !== 'Closed' && (
                    <>
                      <Select value={caseDetail.stage} onValueChange={updateCaseStage} disabled={updating}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="default"
                        onClick={() => setShowKBImprovement(true)}
                        disabled={!kbSuggestions?.can_create_draft && !kbSuggestions?.can_update_existing}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Create KB
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{caseDetail.description}</p>
                </div>

                {/* AI Response */}
                {caseDetail.metadata.ai_summary && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800 dark:text-blue-200">AI Response</span>
                      {caseDetail.metadata.ai_confidence_score && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(caseDetail.metadata.ai_confidence_score * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="text-blue-700 dark:text-blue-300">
                      {caseDetail.metadata.ai_summary}
                    </p>
                  </div>
                )}

                {/* Resolution */}
                {(caseDetail.stage === 'Resolved' || caseDetail.stage === 'Closed') && (
                  <div>
                    <h3 className="font-semibold mb-2">Resolution</h3>
                    {caseDetail.metadata.resolution_notes ? (
                      <p className="text-muted-foreground">{caseDetail.metadata.resolution_notes}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No resolution notes provided</p>
                    )}
                    {caseDetail.metadata.resolution_kind && (
                      <Badge variant="outline" className="mt-2">
                        {caseDetail.metadata.resolution_kind.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Referenced Articles */}
                {caseDetail.referenced_articles.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Referenced Knowledge Articles</h3>
                    <div className="space-y-2">
                      {caseDetail.referenced_articles.map(article => (
                        <Link
                          key={article.id}
                          to={`/member/knowledge/${article.id}`}
                          className="block p-3 border rounded hover:bg-muted transition-colors"
                        >
                          <div className="font-medium">{article.title}</div>
                          <div className="text-sm text-muted-foreground">{article.description}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Created Articles */}
                {caseDetail.resulted_in_articles.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Knowledge Articles Created</h3>
                    <div className="space-y-2">
                      {caseDetail.resulted_in_articles.map(article => (
                        <Link
                          key={article.id}
                          to={`/company-portal/knowledge/${article.id}`}
                          className="block p-3 border rounded hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{article.title}</div>
                              <div className="text-sm text-muted-foreground">{article.description}</div>
                            </div>
                            <Badge variant={article.stage === 'Published' ? 'default' : 'secondary'}>
                              {article.stage}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Conversation Thread */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {caseDetail.thread?.messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.direction === 'inbound' ? "flex-row" : "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs",
                      message.direction === 'inbound' ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {message.metadata?.ai_generated ? (
                        <Bot className="h-4 w-4" />
                      ) : message.direction === 'inbound' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-md",
                      message.direction === 'inbound' ? "text-left" : "text-right"
                    )}>
                      {message.persons && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {message.persons.full_name}
                        </div>
                      )}
                      <div className={cn(
                        "p-3 rounded-lg",
                        message.direction === 'inbound' ? "bg-muted" : "bg-primary text-primary-foreground"
                      )}>
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(message.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              {caseDetail.stage !== 'Resolved' && caseDetail.stage !== 'Closed' && (
                <div className="mt-4 flex gap-2">
                  <Input
                    placeholder="Type your response..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Case Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Case Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div>{new Date(caseDetail.created_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Last Updated</div>
                <div>{new Date(caseDetail.updated_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Priority</div>
                <Badge variant={getPriorityColor(caseDetail.metadata.priority)}>
                  {caseDetail.metadata.priority}
                </Badge>
              </div>
              {caseDetail.metadata.escalation_reason && (
                <div>
                  <div className="text-sm text-muted-foreground">Escalation Reason</div>
                  <Badge variant="destructive" className="text-xs">
                    {caseDetail.metadata.escalation_reason.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* KB Improvement */}
          {kbSuggestions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Knowledge Improvement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Can create draft:</div>
                  <Badge variant={kbSuggestions.can_create_draft ? 'default' : 'secondary'}>
                    {kbSuggestions.can_create_draft ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Related articles:</div>
                  <div className="text-sm">
                    {kbSuggestions.related_articles?.length || 0} found
                  </div>
                </div>
                {kbSuggestions.related_articles && kbSuggestions.related_articles.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Related:</div>
                    <div className="space-y-1">
                      {kbSuggestions.related_articles.slice(0, 3).map((article: any) => (
                        <Link
                          key={article.id}
                          to={`/member/knowledge/${article.id}`}
                          className="block text-xs hover:underline"
                        >
                          {article.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => setShowKBImprovement(true)}
                  disabled={!kbSuggestions.can_create_draft && !kbSuggestions.can_update_existing}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Create Knowledge
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* KB Improvement Modal */}
      {showKBImprovement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create Knowledge from Case</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Action</label>
                <Select value={kbAction} onValueChange={(value: 'create_draft' | 'update_existing') => setKbAction(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create_draft">Create New Draft</SelectItem>
                    {kbSuggestions?.can_update_existing && (
                      <SelectItem value="update_existing">Update Existing Article</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {kbAction === 'update_existing' && kbSuggestions?.related_articles && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Article to Update</label>
                  <Select value={selectedArticle} onValueChange={setSelectedArticle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an article" />
                    </SelectTrigger>
                    <SelectContent>
                      {kbSuggestions.related_articles.map((article: any) => (
                        <SelectItem key={article.id} value={article.id}>
                          {article.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  value={kbForm.title}
                  onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })}
                  placeholder="Article title"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Summary</label>
                <Textarea
                  value={kbForm.summary}
                  onChange={(e) => setKbForm({ ...kbForm, summary: e.target.value })}
                  placeholder="Brief summary"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Content</label>
                <Textarea
                  value={kbForm.content}
                  onChange={(e) => setKbForm({ ...kbForm, content: e.target.value })}
                  placeholder="Full article content"
                  rows={6}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Article Type</label>
                  <Select value={kbForm.article_kind} onValueChange={(value) => setKbForm({ ...kbForm, article_kind: value })}>
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
                  <label className="text-sm font-medium mb-2 block">Audience</label>
                  <div className="space-y-2">
                    {['customer', 'developer', 'operator', 'admin'].map(audience => (
                      <label key={audience} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={kbForm.audience.includes(audience)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setKbForm({ ...kbForm, audience: [...kbForm.audience, audience] })
                            } else {
                              setKbForm({ ...kbForm, audience: kbForm.audience.filter(a => a !== audience) })
                            }
                          }}
                        />
                        <span className="text-sm">{audience}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={createKBFromCase} disabled={updating}>
                  {updating ? 'Creating...' : 'Create Knowledge'}
                </Button>
                <Button variant="outline" onClick={() => setShowKBImprovement(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
