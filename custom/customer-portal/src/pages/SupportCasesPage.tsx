import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { MessageSquare, Bot, Send, ArrowLeft, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '../lib/utils'

interface SupportCase {
  id: string
  title: string
  description: string
  metadata: {
    priority: string
    ai_confidence_score?: number
    escalation_reason?: string
    ai_summary?: string
  }
  stage: string
  created_at: string
  updated_at: string
  thread: {
    id: string
    messages: Array<{
      body: string
      direction: string
      created_at: string
      actor_principal_id?: string
      persons?: {
        full_name: string
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
}

export default function SupportCasesPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const { currentAccountId, profile } = useAuth()
  const [caseDetail, setCaseDetail] = useState<SupportCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (caseId) {
      loadCase()
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !caseId || !currentAccountId) return

    try {
      setSending(true)
      
      let threadId = caseDetail?.thread?.id
      
      // Create thread if it doesn't exist
      if (!threadId) {
        const newThread = await apiPost('/threads', {
          target_type: 'item',
          target_id: caseId,
          thread_type: 'support',
          visibility: 'portal'
        })
        threadId = newThread.id
      }
      
      // Post message to thread
      await apiPost('/messages', {
        thread_id: threadId,
        body: newMessage,
        direction: 'outbound',
        visibility: 'portal'
      })
      
      setNewMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      await loadCase()
    }
  }

  const tryAISupport = async () => {
    if (!caseId || !currentAccountId) return

    try {
      await apiPost('/custom/ai-support', {
        case_id: caseId,
        user_message: caseDetail?.description || ''
      })
      await loadCase()
    } catch (err) {
      console.error('AI support failed:', err)
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
        <Link to="/customer-portal/support" className="text-primary hover:underline mb-2 block">
          ← Back to Support
        </Link>
        <div className="flex items-center gap-2 mb-4">
          {getStageIcon(caseDetail.stage)}
          <Badge variant="outline">{caseDetail.stage}</Badge>
          <Badge variant={getPriorityColor(caseDetail.metadata.priority)}>
            {caseDetail.metadata.priority}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold">{caseDetail.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Case Details */}
          <Card>
            <CardHeader>
              <CardTitle>Case Details</CardTitle>
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

                {/* Try AI Support */}
                {caseDetail.stage === 'Open' && !caseDetail.metadata.ai_summary && (
                  <div className="text-center">
                    <Button onClick={tryAISupport} variant="outline">
                      <Bot className="h-4 w-4 mr-2" />
                      Try AI Support
                    </Button>
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
                        <span>U</span>
                      ) : (
                        <span>S</span>
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
                        <p className="text-sm">{message.body}</p>
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
                    placeholder="Type your message..."
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

          {/* Referenced Articles */}
          {caseDetail.referenced_articles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Knowledge Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {caseDetail.referenced_articles.map(article => (
                    <Link
                      key={article.id}
                      to={`/customer-portal/knowledge/${article.id}`}
                      className="block p-2 border rounded hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-sm">{article.title}</div>
                      <div className="text-xs text-muted-foreground">{article.description}</div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
