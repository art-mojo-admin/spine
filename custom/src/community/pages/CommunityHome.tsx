import { Fragment } from 'react'
import { useCommunityBootstrap } from '@custom/community/hooks/useCommunityBootstrap'
import type {
  CommunityChannelSummary,
  CommunityCohortSummary,
  CommunityEventSummary,
  CommunityLessonSummary,
  CommunityPersona,
  CommunityStats,
} from '@custom/community/types'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function PersonaPanel({ persona }: { persona: CommunityPersona }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white">
        {persona.avatarUrl ? (
          <img src={persona.avatarUrl} alt={persona.displayName ?? 'Member avatar'} className="h-full w-full rounded-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
            {(persona.displayName ?? 'Member').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-semibold text-card-foreground">{persona.displayName ?? 'Community Member'}</div>
        <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{persona.role}</div>
        <div className="flex flex-wrap gap-2">
          {persona.badges.map(badge => (
            <span key={badge} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ))}
        </div>
      </div>
      <div className="ml-auto text-right">
        <div className="text-sm uppercase text-muted-foreground">Streak</div>
        <div className="text-3xl font-bold text-green-500">{persona.streakDays}d</div>
      </div>
    </div>
  )
}

function StatsGrid({ stats }: { stats: CommunityStats }) {
  const entries: Array<{ label: string; value: number; accent: string }> = [
    { label: 'Members Online', value: stats.membersOnline, accent: 'from-teal-500 to-emerald-500' },
    { label: 'Posts This Week', value: stats.postsThisWeek, accent: 'from-orange-500 to-rose-500' },
    { label: 'Lessons Completed', value: stats.lessonsCompleted, accent: 'from-sky-500 to-blue-600' },
    { label: 'Upcoming Events', value: stats.upcomingEvents, accent: 'from-violet-500 to-indigo-600' },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(entry => (
        <div key={entry.label} className="rounded-xl border bg-gradient-to-br p-4 text-white shadow-sm" style={{ backgroundImage: undefined }}>
          <div className="text-xs uppercase tracking-wide text-white/70">{entry.label}</div>
          <div className="text-2xl font-semibold">{entry.value}</div>
        </div>
      ))}
    </div>
  )
}

function ChannelList({ channels }: { channels: CommunityChannelSummary[] }) {
  if (!channels.length) {
    return <div className="text-sm text-muted-foreground">No channels yet. Start by creating your first discussion space.</div>
  }

  return (
    <div className="space-y-3">
      {channels.map(channel => (
        <div key={channel.id} className="flex items-center gap-4 rounded-lg border p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
            {channel.category.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-card-foreground">
              {channel.name}
              {channel.pinned && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Pinned</span>}
            </div>
            <p className="text-sm text-muted-foreground">{channel.description}</p>
          </div>
          <div className="ml-auto text-right text-sm text-muted-foreground">
            <div>{channel.unreadCount} unread</div>
            <div className="text-xs">Last activity {new Date(channel.lastActivityAt).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LessonList({ lessons }: { lessons: CommunityLessonSummary[] }) {
  if (!lessons.length) {
    return <div className="text-sm text-muted-foreground">No lessons assigned yet.</div>
  }

  return (
    <div className="space-y-4">
      {lessons.map(lesson => (
        <div key={lesson.id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-card-foreground">{lesson.title}</div>
              <div className="text-sm text-muted-foreground capitalize">{lesson.status.replace('_', ' ')}</div>
            </div>
            <div className="text-lg font-semibold text-primary">{lesson.progressPercent}%</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${lesson.progressPercent}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function EventList({ events }: { events: CommunityEventSummary[] }) {
  if (!events.length) {
    return <div className="text-sm text-muted-foreground">No upcoming events.</div>
  }

  return (
    <div className="space-y-3">
      {events.map(event => (
        <div key={event.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-base font-semibold text-card-foreground">{event.title}</div>
            <div className="text-sm text-muted-foreground">{event.subtitle}</div>
          </div>
          <div className="sm:ml-auto text-sm text-muted-foreground">
            <div>{new Date(event.startAt).toLocaleString()}</div>
            <div>{event.location}</div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">{event.rsvpState}</div>
        </div>
      ))}
    </div>
  )
}

function CohortList({ cohorts }: { cohorts: CommunityCohortSummary[] }) {
  if (!cohorts.length) {
    return <div className="text-sm text-muted-foreground">No cohorts live yet.</div>
  }

  return (
    <div className="space-y-3">
      {cohorts.map(cohort => (
        <div key={cohort.id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-card-foreground">{cohort.title}</div>
              <div className="text-sm text-muted-foreground">{cohort.focus}</div>
            </div>
            <div className="text-sm text-muted-foreground">{cohort.memberCount} members</div>
          </div>
          <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            Next event: {cohort.nextEventAt ? new Date(cohort.nextEventAt).toLocaleDateString() : 'TBD'}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CommunityHome() {
  const { data, loading, error } = useCommunityBootstrap()

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">Loading community</div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <div className="text-lg font-semibold text-destructive">Unable to load community</div>
        <div className="text-sm text-muted-foreground">{error}</div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { persona, stats, channels, lessons, events, cohorts } = data

  return (
    <div className="space-y-8 p-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <PersonaPanel persona={persona} />
      </div>

      <StatsGrid stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Channels">
            <ChannelList channels={channels} />
          </SectionCard>
          <SectionCard title="Lessons">
            <LessonList lessons={lessons} />
          </SectionCard>
        </div>
        <div className="space-y-6">
          <SectionCard title="Events">
            <EventList events={events} />
          </SectionCard>
          <SectionCard title="Cohorts">
            <CohortList cohorts={cohorts} />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

export default CommunityHome
