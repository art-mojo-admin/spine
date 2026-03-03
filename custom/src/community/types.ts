export type CommunityRole = 'member' | 'moderator' | 'instructor'

export interface CommunityPersona {
  id: string | null
  displayName: string | null
  avatarUrl: string | null
  role: CommunityRole
  badges: string[]
  streakDays: number
}

export interface CommunityStats {
  membersOnline: number
  postsThisWeek: number
  lessonsCompleted: number
  upcomingEvents: number
}

export interface CommunityChannelSummary {
  id: string
  name: string
  description: string
  category: 'topic' | 'cohort' | 'event'
  unreadCount: number
  lastActivityAt: string
  pinned?: boolean
}

export interface CommunityLessonSummary {
  id: string
  title: string
  progressPercent: number
  status: 'not_started' | 'in_progress' | 'complete'
  nextLessonAt?: string | null
}

export interface CommunityEventSummary {
  id: string
  title: string
  subtitle: string
  startAt: string
  endAt: string
  rsvpState: 'open' | 'going' | 'waitlisted'
  location: string
}

export interface CommunityCohortSummary {
  id: string
  title: string
  memberCount: number
  focus: string
  nextEventAt: string | null
}

export interface CommunityBootstrapPayload {
  persona: CommunityPersona
  stats: CommunityStats
  channels: CommunityChannelSummary[]
  lessons: CommunityLessonSummary[]
  events: CommunityEventSummary[]
  cohorts: CommunityCohortSummary[]
}
