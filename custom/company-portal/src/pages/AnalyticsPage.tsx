import { useEffect, useState } from 'react'
import { apiGet } from './lib/api'
import { useAuth } from './hooks/useAuth'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Users, MessageSquare, Bot, AlertTriangle, FileText, Download } from 'lucide-react'

interface AnalyticsData {
  report: string
  time_range: string
  [key: string]: any // Allow dynamic properties for different report structures
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function AnalyticsPage() {
  const { currentAccountId } = useAuth()
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Record<string, AnalyticsData>>({})

  const reportTypes = [
    { key: 'escalation-reasons', label: 'Escalation Reasons', icon: AlertTriangle },
    { key: 'kb-gaps', label: 'Knowledge Gaps', icon: FileText },
    { key: 'ai-resolution-rate', label: 'AI Resolution Rate', icon: Bot },
    { key: 'top-unanswered', label: 'Top Unanswered', icon: MessageSquare },
    { key: 'knowledge-creation', label: 'Knowledge Creation', icon: FileText },
    { key: 'community-support-correlation', label: 'Community-Support', icon: Users }
  ]

  useEffect(() => {
    loadReports()
  }, [timeRange])

  const loadReports = async () => {
    if (!currentAccountId) return

    try {
      setLoading(true)
      const reportData: Record<string, AnalyticsData> = {}

      for (const reportType of reportTypes) {
        const response = await apiGet(`/custom/app-analytics?report=${reportType.key}&time_range=${timeRange}`)
        reportData[reportType.key] = response as AnalyticsData
      }

      setReports(reportData)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportData = () => {
    const dataStr = JSON.stringify(reports, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `spine-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Insights into support performance and knowledge gaps
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
            <Button variant="outline" onClick={exportData}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports['ai-resolution-rate'] as any)?.summary?.total_attempts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              AI support attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Resolution Rate</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports['ai-resolution-rate'] as any)?.summary?.overall_resolution_rate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Cases resolved by AI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KB Articles Created</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports['knowledge-creation'] as any)?.summary?.total_articles_created || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              From resolved cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unanswered Questions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(reports['top-unanswered'] as any)?.total_unanswered || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Community questions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escalation Reasons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Escalation Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports['escalation-reasons'] as any)?.breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(reports['escalation-reasons'] as any).breakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="reason" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No escalation data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Resolution Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Resolution Rate Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports['ai-resolution-rate'] as any)?.trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={(reports['ai-resolution-rate'] as any).trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="resolution_rate" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Knowledge Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports['kb-gaps'] as any)?.themes?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(reports['kb-gaps'] as any).themes.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="theme" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No knowledge gap data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Community-Support Correlation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Community Post Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports['community-support-correlation'] as any)?.patterns?.by_post_kind?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={(reports['community-support-correlation'] as any).patterns.by_post_kind}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ post_kind, count }: any) => `${post_kind}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {(reports['community-support-correlation'] as any).patterns.by_post_kind.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No community data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Top Unanswered Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Top Unanswered Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports['top-unanswered'] as any)?.posts?.length > 0 ? (
              <div className="space-y-3">
                {(reports['top-unanswered'] as any).posts.slice(0, 5).map((post: any, index: number) => (
                  <div key={post.id} className="flex items-start justify-between p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">{post.title}</div>
                      <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {post.description}
                      </div>
                      <div className="flex gap-1">
                        {post.tags?.slice(0, 2).map((tag: string) => (
                          <span key={tag} className="text-xs bg-muted px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No unanswered questions
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Creation Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Knowledge Creation Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports['knowledge-creation'] as any)?.trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(reports['knowledge-creation'] as any).trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="articles_created" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No knowledge creation data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
