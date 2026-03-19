import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { MessageSquare, Bot, AlertCircle, Clock, User, Search, Filter } from 'lucide-react'
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
  created_by: string
  creator: {
    full_name: string
    email: string
  }
}

export default function SupportQueuePage() {
  const { currentAccountId, profile } = useAuth()
  const [cases, setCases] = useState<SupportCase[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStage, setFilterStage] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCase, setSelectedCase] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    loadCases()
  }, [filterStage, filterPriority, searchQuery])

  const loadCases = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStage) params.set('status', filterStage)
      if (filterPriority) params.set('priority', filterPriority)
      if (searchQuery) params.set('search', searchQuery)
      
      const response = await apiGet(`/custom/support?mode=queue&${params}`)
      setCases(response)
    } catch (err) {
      console.error('Failed to load support queue:', err)
    } finally {
      setLoading(false)
    }
  }

  const assignToMe = async (caseId: string) => {
    if (!currentAccountId || !profile?.person_id) return

    try {
      setAssigning(true)
      await apiPatch(`/custom/support/${caseId}`, {
        stage: 'In Progress',
        assigned_to: profile.person_id
      })
      
      await loadCases()
    } catch (err) {
      console.error('Failed to assign case:', err)
    } finally {
      setAssigning(false)
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
      case 'Resolved': return <User className="h-4 w-4" />
      case 'Closed': return <User className="h-4 w-4" />
      default: return <MessageSquare className="h-4 w-4" />
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Open': return 'secondary'
      case 'AI Attempt': return 'outline'
      case 'Escalated': return 'destructive'
      case 'In Progress': return 'default'
      case 'Resolved': return 'default'
      case 'Closed': return 'secondary'
      default: return 'secondary'
    }
  }

  const filteredCases = cases.filter(case_ => {
    if (searchQuery && !case_.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !case_.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  const stats = {
    total: cases.length,
    open: cases.filter(c => c.stage === 'Open').length,
    escalated: cases.filter(c => c.stage === 'Escalated').length,
    inProgress: cases.filter(c => c.stage === 'In Progress').length,
    urgent: cases.filter(c => c.metadata.priority === 'urgent').length
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Support Queue</h1>
        <p className="text-muted-foreground">
          Manage and resolve support cases from the community
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Cases</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            <div className="text-sm text-muted-foreground">Open</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.escalated}</div>
            <div className="text-sm text-muted-foreground">Escalated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-sm text-muted-foreground">Urgent</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Stages</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="AI Attempt">AI Attempt</SelectItem>
                <SelectItem value="Escalated">Escalated</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cases List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading support queue...</div>
        </div>
      ) : filteredCases.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No cases found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterStage || filterPriority
                ? 'Try adjusting your filters'
                : 'No support cases in the queue'
              }
            </p>
            {(searchQuery || filterStage || filterPriority) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setFilterStage('')
                  setFilterPriority('')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((case_) => (
            <Card key={case_.id} className={cn(
              "hover:shadow-md transition-shadow",
              selectedCase === case_.id && "ring-2 ring-primary"
            )}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStageIcon(case_.stage)}
                      <Link
                        to={`/operator/cases/${case_.id}`}
                        className="font-medium hover:text-primary transition-colors text-lg"
                      >
                        {case_.title}
                      </Link>
                      <Badge variant={getStageColor(case_.stage)}>
                        {case_.stage}
                      </Badge>
                      <Badge variant={getPriorityColor(case_.metadata.priority)}>
                        {case_.metadata.priority}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-2 line-clamp-2">
                      {case_.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>From: {case_.creator.full_name}</span>
                      <span>Created: {new Date(case_.created_at).toLocaleDateString()}</span>
                      <span>Updated: {new Date(case_.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Link to={`/operator/cases/${case_.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    {case_.stage === 'Escalated' && (
                      <Button
                        size="sm"
                        onClick={() => assignToMe(case_.id)}
                        disabled={assigning}
                      >
                        {assigning ? 'Assigning...' : 'Assign to Me'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* AI Response Summary */}
                {case_.metadata.ai_summary && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
