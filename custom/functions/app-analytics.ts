import { createHandler, requireAuth, requireTenant, requireRole, json, error } from '../../core/functions/_shared/middleware'
import { db } from '../../core/functions/_shared/db'

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    const report = params.get('report')
    const timeRange = params.get('time_range') || '30d'

    try {
      switch (report) {
        case 'escalation-reasons':
          return await getEscalationReasons(ctx.accountId!, timeRange)
        case 'kb-gaps':
          return await getKBGaps(ctx.accountId!, timeRange)
        case 'ai-resolution-rate':
          return await getAIResolutionRate(ctx.accountId!, timeRange)
        case 'top-unanswered':
          return await getTopUnanswered(ctx.accountId!, timeRange)
        case 'knowledge-creation':
          return await getKnowledgeCreation(ctx.accountId!, timeRange)
        case 'community-support-correlation':
          return await getCommunitySupportCorrelation(ctx.accountId!, timeRange)
        default:
          return error('Invalid report type')
      }
    } catch (err: any) {
      return error(err.message || 'Analytics query failed', 500)
    }
  },
})

async function getEscalationReasons(accountId: string, timeRange: string) {
  const days = parseInt(timeRange.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error: dbErr } = await db
    .from('field_values')
    .select(`
      value,
      items!inner(
        created_at,
        stage_definitions!inner(name)
      )
    `)
    .eq('account_id', accountId)
    .eq('field_key', 'escalation_reason')
    .eq('items.status', 'active')
    .eq('items.stage_definitions.name', 'Escalated')
    .gte('items.created_at', startDate.toISOString())

  if (dbErr) throw dbErr

  // Count by escalation reason
  const reasonCounts = {}
  ;(data || []).forEach(row => {
    const reason = row.value || 'unknown'
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
  })

  const total = Object.values(reasonCounts).reduce((sum, count) => sum + count, 0)
  const result = Object.entries(reasonCounts).map(([reason, count]) => ({
    reason: reason.replace(/_/g, ' '),
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  })).sort((a, b) => b.count - a.count)

  return json({
    report: 'escalation-reasons',
    time_range: timeRange,
    total_cases: total,
    breakdown: result
  })
}

async function getKBGaps(accountId: string, timeRange: string) {
  const days = parseInt(timeRange.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get cases with low AI confidence scores
  const { data: lowConfidenceCases, error: confidenceErr } = await db
    .from('field_values')
    .select(`
      value::text as confidence_score,
      items!inner(
        id,
        title,
        created_at,
        metadata
      )
    `)
    .eq('account_id', accountId)
    .eq('field_key', 'ai_confidence_score')
    .lt('value', 0.5)
    .eq('items.status', 'active')
    .gte('items.created_at', startDate.toISOString())

  if (confidenceErr) throw confidenceErr

  // Extract common themes from low confidence cases
  const themes = {}
  ;(lowConfidenceCases || []).forEach(row => {
    const title = row.items.title.toLowerCase()
    const description = row.items.description?.toLowerCase() || ''
    const text = `${title} ${description}`
    
    // Simple keyword extraction
    const keywords = ['api', 'ui', 'error', 'login', 'authentication', 'integration', 'database', 'performance', 'security']
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        themes[keyword] = (themes[keyword] || 0) + 1
      }
    })
  })

  // Get top search terms with no results
  const { data: searchFailures, error: searchErr } = await db
    .from('agent_executions')
    .select(`
      trigger_data,
      output_data
    `)
    .eq('account_id', accountId)
    .like('execution_id', 'ai-support-%')
    .like('output_data->>escalated', 'true')
    .gte('created_at', startDate.toISOString())

  if (searchErr) throw searchErr

  const searchTerms = {}
  ;(searchFailures || []).forEach(execution => {
    const query = execution.trigger_data?.user_message || ''
    if (query.length > 0) {
      // Simple term extraction
      const terms = query.toLowerCase().split(' ').filter(term => term.length > 3)
      terms.forEach(term => {
        searchTerms[term] = (searchTerms[term] || 0) + 1
      })
    }
  })

  return json({
    report: 'kb-gaps',
    time_range: timeRange,
    low_confidence_cases: lowConfidenceCases?.length || 0,
    themes: Object.entries(themes).map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    search_terms: Object.entries(searchTerms).map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count).slice(0, 10)
  })
}

async function getAIResolutionRate(accountId: string, timeRange: string) {
  const days = parseInt(timeRange.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get all AI support attempts
  const { data: attempts, error: attemptsErr } = await db
    .from('agent_executions')
    .select(`
      execution_id,
      trigger_data,
      output_data,
      execution_status,
      created_at
    `)
    .eq('account_id', accountId)
    .like('execution_id', 'ai-support-%')
    .gte('created_at', startDate.toISOString())

  if (attemptsErr) throw attemptsErr

  const total = attempts?.length || 0
  const resolved = attempts?.filter(exec => exec.output_data?.escalated === false).length || 0
  const escalated = attempts?.filter(exec => exec.output_data?.escalated === true).length || 0

  // Calculate trend over time
  const dailyStats = {}
  ;(attempts || []).forEach(exec => {
    const day = exec.created_at.split('T')[0]
    if (!dailyStats[day]) {
      dailyStats[day] = { total: 0, resolved: 0, escalated: 0 }
    }
    dailyStats[day].total += 1
    if (exec.output_data?.escalated === false) {
      dailyStats[day].resolved += 1
    } else {
      dailyStats[day].escalalated += 1
    }
  })

  const trend = Object.entries(dailyStats).map(([day, stats]) => ({
    date: day,
    total: stats.total,
    resolved: stats.resolved,
    escalated: stats.escalalated,
    resolution_rate: stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0
  })).sort((a, b) => a.date.localeCompare(b.date))

  return json({
    report: 'ai-resolution-rate',
    time_range: timeRange,
    summary: {
      total_attempts: total,
      resolved_cases: resolved,
      escalated_cases: escalated,
      overall_resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0
    },
    trend
  })
}

async function getTopUnanswered(accountId: string, timeRange: string) {
  const days = parseInt(timeRange.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get community posts with no replies
  const { data: posts, error: postsErr } = await db
    .from('items')
    .select(`
      id,
      title,
      description,
      created_at,
      metadata,
      field_values!inner(field_key, value)
    `)
    .eq('account_id', accountId)
    .eq('item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'community_post').single()).data?.id)
    .eq('status', 'active')
    .eq('field_values.field_key', 'post_kind')
    .eq('field_values.value', 'question')
    .gte('created_at', startDate.toISOString())

  if (postsErr) throw postsErr

  const unansweredPosts = []
  
  for (const post of posts || []) {
    // Check if post has replies
    const { data: thread } = await db
      .from('threads')
      .select('id')
      .eq('target_type', 'item')
      .eq('target_id', post.id)
      .eq('account_id', accountId)
      .single()

    if (thread) {
      const { data: messageCount } = await db
        .from('messages')
        .select('id')
        .eq('thread_id', thread.id)
        .eq('direction', 'inbound')
        .gt('sequence', 1) // More than just the original post

      if (!messageCount || messageCount.length === 0) {
        // Extract metadata
        const metadata = { ...post.metadata }
        const fieldValues = post.field_values || []
        fieldValues.forEach((fv: any) => {
          metadata[fv.field_key] = fv.value
        })

        unansweredPosts.push({
          id: post.id,
          title: post.title,
          description: post.description,
          created_at: post.created_at,
          tags: metadata.tags || []
        })
      }
    }
  }

  // Sort by created_at (oldest unanswered first)
  unansweredPosts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return json({
    report: 'top-unanswered',
    time_range: timeRange,
    total_unanswered: unansweredPosts.length,
    posts: unansweredPosts.slice(0, 20) // Top 20 oldest unanswered
  })
}

async function getKnowledgeCreation(accountId: string, timeRange: string) {
  const days = parseInt(timeRange.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get knowledge articles created from cases
  const { data: kbFromCases, error: kbErr } = await db
    .from('item_links')
    .select(`
      source_item_id,
      target_item_id,
      created_at,
      source_items!inner(
        title,
        created_at,
        metadata,
        stage_definitions!inner(name)
      ),
      target_items!inner(
        title,
        stage_definitions!inner(name)
      )
    `)
    .eq('account_id', accountId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'resulted_in').single()).data?.id)
    .eq('target_items.item_type_id', (await db.from('item_type_registry').select('id').eq('slug', 'knowledge_article').single()).data?.id)
    .gte('created_at', startDate.toISOString())

  if (kbErr) throw kbErr

  // Group by week
  const weeklyStats = {}
  ;(kbFromCases || []).forEach(link => {
    const week = getWeek(link.created_at)
    if (!weeklyStats[week]) {
      weeklyStats[week] = { articles_created: 0, cases_resolved: 0 }
    }
    weeklyStats[week].articles_created += 1
    if (link.source_items?.stage_definitions?.name === 'Resolved') {
      weeklyStats[week].cases_resolved += 1
    }
  })

  const trend = Object.entries(weeklyStats).map(([week, stats]) => ({
    week,
    articles_created: stats.articles_created,
    cases_resolved: stats.cases_resolved
  })).sort((a, b) => a.week.localeCompare(b.week))

  // Get article types
  const articleTypes = {}
  ;(kbFromCases || []).forEach(link => {
    const metadata = link.source_items?.metadata || {}
    const articleKind = metadata.resolution_kind || 'unknown'
    articleTypes[articleKind] = (articleTypes[articleKind] || 0) + 1
  })

  return json({
    report: 'knowledge-creation',
    time_range: timeRange,
    summary: {
      total_articles_created: kbFromCases?.length || 0,
      cases_with_kb_outcome: kbFromCases?.filter(link => link.source_items?.stage_definitions?.name === 'Resolved').length || 0
    },
    trend,
    article_types: Object.entries(articleTypes).map(([type, count]) => ({ type, count }))
  })
}

async function getCommunitySupportCorrelation(accountId: string, timeRange: string) {
  const days = parseInt(timeRange.replace('d', '')) || 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get community posts that resulted in support cases
  const { data: correlations, error: corrErr } = await db
    .from('item_links')
    .select(`
      source_item_id,
      target_item_id,
      created_at,
      source_items!inner(
        title,
        created_at,
        metadata,
        field_values!inner(field_key, value)
      ),
      target_items!inner(
        title,
        created_at,
        metadata,
        stage_definitions!inner(name)
      )
    `)
    .eq('account_id', accountId)
    .eq('link_type_id', (await db.from('link_type_registry').select('id').eq('slug', 'prompted_by').single()).data?.id)
    .gte('created_at', startDate.toISOString())

  if (corrErr) throw corrErr

  // Analyze patterns
  const patterns = {
    by_post_kind: {},
    by_time_to_case: {},
    by_case_outcome: {}
  }

  ;(correlations || []).forEach(correlation => {
    // Extract post metadata
    const postMetadata = { ...correlation.source_items?.metadata || {} }
    const postFieldValues = correlation.source_items?.field_values || []
    postFieldValues.forEach((fv: any) => {
      postMetadata[fv.field_key] = fv.value
    })

    // Group by post kind
    const postKind = postMetadata.post_kind || 'unknown'
    patterns.by_post_kind[postKind] = (patterns.by_post_kind[postKind] || 0) + 1

    // Calculate time to case creation
    const postCreated = new Date(correlation.source_items.created_at)
    const caseCreated = new Date(correlation.target_items.created_at)
    const hoursToCase = Math.floor((caseCreated.getTime() - postCreated.getTime()) / (1000 * 60 * 60))
    
    const timeBucket = hoursToCase < 24 ? '< 24h' : hoursToCase < 72 ? '24-72h' : '> 72h'
    patterns.by_time_to_case[timeBucket] = (patterns.by_time_to_case[timeBucket] || 0) + 1

    // Group by case outcome
    const caseOutcome = correlation.target_items?.stage_definitions?.name || 'unknown'
    patterns.by_case_outcome[caseOutcome] = (patterns.by_case_outcome[caseOutcome] || 0) + 1
  })

  return json({
    report: 'community-support-correlation',
    time_range: timeRange,
    summary: {
      total_correlations: correlations?.length || 0,
      unique_posts: [...new Set((correlations || []).map(c => c.source_item_id))].length,
      unique_cases: [...new Set((correlations || []).map(c => c.target_item_id))].length
    },
    patterns: {
      by_post_kind: Object.entries(patterns.by_post_kind).map(([kind, count]) => ({ post_kind: kind, count })),
      by_time_to_case: Object.entries(patterns.by_time_to_case).map(([time, count]) => ({ time_bucket: time, count })),
      by_case_outcome: Object.entries(patterns.by_case_outcome).map(([outcome, count]) => ({ case_outcome: outcome, count }))
    }
  })
}

// Helper function to get week number
function getWeek(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${year}-W${week.toString().padStart(2, '0')}`
}
