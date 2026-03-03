import { createHandler, requireAuth, requireTenant, json, error } from '../../netlify/functions/_shared/middleware'
import { db } from '../../netlify/functions/_shared/db'

interface ThreadRow {
  id: string
  thread_type: string
  metadata: Record<string, any> | null
  updated_at: string
}

export default createHandler({
  async GET(_req, ctx) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    try {
      const [personRes, profileRes, membershipRes, memberListRes, threadRes, lessonRes, completionRes, eventRes, cohortRes] =
        await Promise.all([
          db.from('persons').select('id, full_name, metadata').eq('id', ctx.personId).single(),
          db.from('profiles').select('display_name, avatar_url').eq('person_id', ctx.personId).maybeSingle(),
          db
            .from('memberships')
            .select('account_role')
            .eq('person_id', ctx.personId)
            .eq('account_id', ctx.accountId)
            .maybeSingle(),
          db
            .from('memberships')
            .select('id')
            .eq('account_id', ctx.accountId)
            .eq('status', 'active'),
          db
            .from('threads')
            .select('id, thread_type, metadata, updated_at')
            .eq('account_id', ctx.accountId)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(10),
          db
            .from('knowledge_base_articles')
            .select('id, title, parent_article_id, updated_at')
            .eq('account_id', ctx.accountId)
            .eq('is_active', true)
            .not('parent_article_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(6),
          db
            .from('lesson_completions')
            .select('article_id, completed_at')
            .eq('account_id', ctx.accountId)
            .eq('person_id', ctx.personId),
          db
            .from('items')
            .select('id, title, metadata, created_at')
            .eq('account_id', ctx.accountId)
            .eq('item_type', 'event')
            .order('created_at', { ascending: true })
            .limit(5),
          db
            .from('workflow_definitions')
            .select('id, name, metadata, updated_at')
            .eq('account_id', ctx.accountId)
            .order('updated_at', { ascending: false })
            .limit(5),
        ])

      const person = personRes.data
      const profile = profileRes.data
      const membership = membershipRes.data
      const members = memberListRes.data || []
      const threads = (threadRes.data || []) as ThreadRow[]
      const lessons = lessonRes.data || []
      const completions = completionRes.data || []
      const events = eventRes.data || []
      const cohorts = cohortRes.data || []

      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const postsThisWeek = threads.filter((t) => new Date(t.updated_at) >= weekAgo).length
      const upcomingEvents = events.filter((evt) => {
        const start = evt.metadata?.start_at || evt.metadata?.startAt || evt.metadata?.start || evt.created_at
        return new Date(start) >= now
      }).length
      const lessonCompletionSet = new Set(completions.map((c) => c.article_id))

      const persona = {
        id: person?.id ?? ctx.personId,
        displayName: profile?.display_name || person?.full_name || 'Member',
        avatarUrl: profile?.avatar_url || null,
        role: (membership?.account_role as 'member' | 'moderator' | 'instructor') || 'member',
        badges: membership?.account_role === 'admin' ? ['Admin'] : ['Member'],
        streakDays: completions.length,
      }

      const stats = {
        membersOnline: members.length,
        postsThisWeek,
        lessonsCompleted: completions.length,
        upcomingEvents,
      }

      const channels = (threads.length ? threads : [{
        id: 'general',
        thread_type: 'discussion',
        metadata: { name: 'General', description: 'Kick off conversations with the cohort.' },
        updated_at: now.toISOString(),
      }]).map((thread) => ({
        id: thread.id,
        name: thread.metadata?.channel_name || thread.metadata?.name || thread.thread_type || 'Discussion',
        description: thread.metadata?.description || 'Community thread',
        category: (thread.metadata?.category as 'topic' | 'cohort' | 'event') || 'topic',
        unreadCount: thread.metadata?.unread_count || 0,
        lastActivityAt: thread.updated_at,
        pinned: !!thread.metadata?.pinned,
      }))

      const lessonSummaries = (lessons.length ? lessons : [{ id: 'lesson-template', title: 'Orientation', parent_article_id: 'course', updated_at: now.toISOString() }]).map((lesson) => {
        const completed = lessonCompletionSet.has(lesson.id)
        return {
          id: lesson.id,
          title: lesson.title,
          progressPercent: completed ? 100 : 0,
          status: completed ? 'complete' : 'not_started',
          nextLessonAt: null,
        }
      })

      const eventSummaries = (events.length ? events : [{ id: 'event-template', title: 'Welcome Call', metadata: { start_at: now.toISOString(), end_at: now.toISOString() }, created_at: now.toISOString() }]).map((evt) => {
        const start = evt.metadata?.start_at || evt.metadata?.startAt || evt.created_at
        const end = evt.metadata?.end_at || evt.metadata?.endAt || start
        return {
          id: evt.id,
          title: evt.title,
          subtitle: evt.metadata?.subtitle || 'Live session',
          startAt: start,
          endAt: end,
          rsvpState: 'open',
          location: evt.metadata?.location || 'Online',
        }
      })

      const cohortSummaries = (cohorts.length ? cohorts : [{ id: 'cohort-template', name: 'Cohort Alpha', metadata: {}, updated_at: now.toISOString() }]).map((cohort) => ({
        id: cohort.id,
        title: cohort.name,
        memberCount: members.length,
        focus: cohort.metadata?.focus || 'General',
        nextEventAt: eventSummaries[0]?.startAt || null,
      }))

      return json({
        persona,
        stats,
        channels,
        lessons: lessonSummaries,
        events: eventSummaries,
        cohorts: cohortSummaries,
      })
    } catch (err: any) {
      console.error('[community-bootstrap] failed', err)
      return error('Failed to load community data', 500)
    }
  },
})
