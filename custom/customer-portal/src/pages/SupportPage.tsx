import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { MessageCircle, Bot, Send, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '../lib/utils'
import { FormRenderer, type ItemTypeSchema } from '../components/ui/FieldRenderer'

interface SupportCase {
  id: string
  title: string
  description: string
  custom_fields: {
    priority: string
    ai_confidence_score?: number
    escalation_reason?: string
    ai_summary?: string
    category?: string
    tags?: string[]
  }
  status: string
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
  const [schema, setSchema] = useState<ItemTypeSchema | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(true)

  // New case form
  const [newCase, setNewCase] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
    tags: []
  })

  useEffect(() => {
    loadSchema()
    loadCases()
  }, [])

  const loadSchema = async () => {
    try {
      setSchemaLoading(true)
      // Fetch the real support_case schema from the API
      const response = await apiGet('/core/admin-types?mode=registry&include_system=true')
      const supportCaseType = response.find((type: any) => type.slug === 'support_case')
      
      if (supportCaseType?.schema) {
        // Transform the schema to include base fields (title, description) + custom fields
        const transformedSchema: ItemTypeSchema = {
          ...supportCaseType.schema,
          fields: {
            title: {
              type: "text",
              required: true
            },
            description: {
              type: "textarea", 
              required: true
            },
            ...supportCaseType.schema.fields
          }
        }
        setSchema(transformedSchema)
      } else {
        throw new Error('Support case schema not found')
      }
    } catch (err) {
      console.error('Failed to load schema:', err)
      // Fallback to minimal schema
      setSchema({
        record_permissions: {
          portal: { create: true, read: "own", update: "own", delete: false }
        },
        fields: {
          title: { type: "text", required: true },
          description: { type: "textarea", required: true },
          priority: { type: "select", options: ["low", "medium", "high", "urgent"], required: true },
          category: { type: "select", options: ["general", "bug", "feature", "question", "incident"], required: false },
          tags: { type: "array", required: false }
        }
      })
    } finally {
      setSchemaLoading(false)
    }
  }

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

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'open': return <MessageCircle className="h-4 w-4" />
      case 'ai_attempt': return <Bot className="h-4 w-4" />
      case 'escalated': return <AlertCircle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'resolved': return <CheckCircle className="h-4 w-4" />
      case 'closed': return <CheckCircle className="h-4 w-4" />
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
            {schemaLoading ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Loading form schema...</div>
              </div>
            ) : schema ? (
              <form onSubmit={handleSubmitCase} className="space-y-4">
                <FormRenderer
                  schema={schema}
                  data={newCase}
                  userRole={profile?.system_role === 'system_admin' ? 'admin' : 'member'}
                  editing={true}
                  onChange={(field, value) => setNewCase({ ...newCase, [field]: value })}
                />

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
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground">Failed to load form schema</div>
              </div>
            )}
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
                        {getStageIcon(case_.status)}
                        <Link
                          to={`/customer-portal/support/cases/${case_.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {case_.title}
                        </Link>
                        <Badge variant={getPriorityColor(case_.custom_fields.priority)}>
                          {case_.custom_fields.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {case_.description}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{case_.status}</div>
                      <div>{new Date(case_.updated_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* AI Response Summary */}
                  {case_.custom_fields.ai_summary && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">AI Response</span>
                        {case_.custom_fields.ai_confidence_score && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(case_.custom_fields.ai_confidence_score * 100)}% confidence
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">
                        {case_.custom_fields.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* Escalation Reason */}
                  {case_.custom_fields.escalation_reason && (
                    <div className="mt-2">
                      <Badge variant="destructive" className="text-xs">
                        Escalated: {case_.custom_fields.escalation_reason.replace(/_/g, ' ')}
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
