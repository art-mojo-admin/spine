import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageCircle, Bot, Send, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

interface AIResponse {
  response: string
  confidence_score: number
  escalated: boolean
  escalation_reason?: string
  articles_used: number
  articles: Array<{
    id: string
    title: string
    summary: string
  }>
}

export default function SupportPage() {
  const { currentAccountId, profile } = useAuth()
  const [cases, setCases] = useState<SupportCase[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewCase, setShowNewCase] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // New case form
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
    tags: []
  })

  useEffect(() => {
    loadCases()
  }, [])

  const loadCases = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const response = await apiGet('/custom/support?mode=my-cases')
      setCases(response)
    } catch (err) {
      console.error('Failed to load cases:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentAccountId || !newCase.title || !newCase.description) return

    try {
      setSubmitting(true)
      const response = await apiPost('/custom/support', newCase)
      
      // Reset form
      setNewCase({
        title: '',
        description: '',
        priority: 'medium',
        category: 'general',
        tags: []
      })
      setShowNewCase(false)
      
      // Reload cases
      await loadCases()

      // Try AI support immediately
      await tryAISupport(response.id, newCase.description)
    } catch (err) {
      console.error('Failed to create case:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const tryAISupport = async (caseId: string, message: string) => {
    if (!currentAccountId) return

    try {
      setAiLoading(true)
      const response = await apiPost('/custom/ai-support', {
        case_id: caseId,
        user_message: message
      })
      setAiResponse(response)
      
      // Reload cases to get updated status
      await loadCases()
    } catch (err) {
      console.error('AI support failed:', err)
    } finally {
      setAiLoading(false)
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
      case 'Open': return <MessageCircle className="h-4 w-4" />
      case 'AI Attempt': return <Bot className="h-4 w-4" />
      case 'Escalated': return <AlertCircle className="h-4 w-4" />
      case 'In Progress': return <Clock className="h-4 w-4" />
      case 'Resolved': return <CheckCircle className="h-4 w-4" />
      case 'Closed': return <CheckCircle className="h-4 w-4" />
      default: return <MessageCircle className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Support</h1>
        <p className="text-muted-foreground">
          Get help with Spine. Our AI assistant will try to help first, then escalate to a human if needed.
        </p>
      </div>

      {/* AI Response Display */}
      {aiResponse && (
        <Card className="mb-6 border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">AI Assistant Response</CardTitle>
              <Badge variant={aiResponse.escalated ? 'destructive' : 'default'}>
                {aiResponse.escalated ? 'Escalated to Human' : 'Resolved'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none mb-4">
              <p>{aiResponse.response}</p>
            </div>
            
            {aiResponse.articles && aiResponse.articles.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Referenced Articles:</h4>
                <div className="space-y-2">
                  {aiResponse.articles.map(article => (
                    <Link
                      key={article.id}
                      to={`/member/knowledge/${article.id}`}
                      className="block p-2 border rounded hover:bg-muted transition-colors"
                    >
                      <div className="font-medium">{article.title}</div>
                      <div className="text-sm text-muted-foreground">{article.summary}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Confidence: {Math.round(aiResponse.confidence_score * 100)}%</span>
              {aiResponse.escalated && aiResponse.escalation_reason && (
                <span>Reason: {aiResponse.escalation_reason.replace(/_/g, ' ')}</span>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setAiResponse(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Case Form */}
      {showNewCase ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Support Case</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitCase} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="Brief description of your issue"
                  value={newCase.title}
                  onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Detailed description of your issue, steps to reproduce, etc."
                  value={newCase.description}
                  onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <Select value={newCase.priority} onValueChange={(value) => setNewCase({ ...newCase, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={newCase.category} onValueChange={(value) => setNewCase({ ...newCase, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="ui">User Interface</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Case'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCase(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowNewCase(true)} className="mb-6">
          <MessageCircle className="h-4 w-4 mr-2" />
          Create Support Case
        </Button>
      )}

      {/* Existing Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Your Support Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading your cases...</div>
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No support cases yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first support case to get help with Spine
              </p>
              <Button onClick={() => setShowNewCase(true)}>
                Create Your First Case
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cases.map((case_) => (
                <div key={case_.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStageIcon(case_.stage)}
                        <Link
                          to={`/member/support/cases/${case_.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {case_.title}
                        </Link>
                        <Badge variant={getPriorityColor(case_.metadata.priority)}>
                          {case_.metadata.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {case_.description}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{case_.stage}</div>
                      <div>{new Date(case_.updated_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* AI Response Summary */}
                  {case_.metadata.ai_summary && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">AI Response</span>
                        {case_.metadata.ai_confidence_score && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(case_.metadata.ai_confidence_score * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">
                        {case_.metadata.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* Escalation Reason */}
                  {case_.metadata.escalation_reason && (
                    <div className="mt-2">
                      <Badge variant="destructive" className="text-xs">
                        Escalated: {case_.metadata.escalation_reason.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
