import type { CustomNavSection, CustomRouteDefinition } from '@core/lib/customRouteTypes'

export const customRoutes: CustomRouteDefinition[] = [
  {
    path: '/custom/community',
    loader: () => import('../community/pages/CommunityHome').then(m => ({ default: m.CommunityHome })),
    layout: 'shell',
    minRole: 'member',
    description: 'Community home experience rendered inside the core shell.',
  },
  {
    path: '/operator/users',
    loader: () => import('../operator/pages/UsersPage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'App admin: manage members, roles, and invitations.',
  },
  {
    path: '/operator/queue',
    loader: () => import('../operator/pages/SupportQueuePage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'Support queue for operators.',
  },
  {
    path: '/operator/cases/:id',
    loader: () => import('../operator/pages/CaseWorkspacePage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'Case workspace for operators.',
  },
  {
    path: '/operator/knowledge',
    loader: () => import('../operator/pages/KnowledgeListPage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'Knowledge base management.',
  },
  {
    path: '/operator/knowledge/:id',
    loader: () => import('../operator/pages/KnowledgeEditorPage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'Knowledge article editor.',
  },
  {
    path: '/operator/community',
    loader: () => import('../operator/pages/CommunityModerationPage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'Community moderation.',
  },
  {
    path: '/operator/analytics',
    loader: () => import('../operator/pages/AnalyticsPage'),
    layout: 'shell',
    minRole: 'operator',
    description: 'App analytics dashboard.',
  },
  {
    path: '/member/support',
    loader: () => import('../member/pages/SupportPage'),
    layout: 'shell',
    minRole: 'member',
    description: 'Member support cases.',
  },
  {
    path: '/member/support/:id',
    loader: () => import('../member/pages/SupportCasesPage'),
    layout: 'shell',
    minRole: 'member',
    description: 'Member support case detail.',
  },
  {
    path: '/member/knowledge',
    loader: () => import('../member/pages/KnowledgePage'),
    layout: 'shell',
    minRole: 'member',
    description: 'Member knowledge base.',
  },
  {
    path: '/member/knowledge/:id',
    loader: () => import('../member/pages/KnowledgeArticlePage'),
    layout: 'shell',
    minRole: 'member',
    description: 'Member knowledge article.',
  },
  {
    path: '/member/community',
    loader: () => import('../member/pages/CommunityPage'),
    layout: 'shell',
    minRole: 'member',
    description: 'Member community.',
  },
  {
    path: '/member/community/:id',
    loader: () => import('../member/pages/CommunityPostPage'),
    layout: 'shell',
    minRole: 'member',
    description: 'Member community post.',
  },
]

export const customNavSections: CustomNavSection[] = [
  {
    key: 'community-app',
    title: 'Community',
    scope: 'primary',
    position: 50,
    items: [
      {
        key: 'community-home',
        label: 'Community',
        to: '/custom/community',
        icon: 'Users',
        minRole: 'member',
      },
    ],
  },
  {
    key: 'member-portal',
    title: 'Support Portal',
    scope: 'primary',
    position: 60,
    items: [
      {
        key: 'member-support',
        label: 'My Cases',
        to: '/member/support',
        icon: 'MessageCircle',
        minRole: 'member',
      },
      {
        key: 'member-knowledge',
        label: 'Knowledge Base',
        to: '/member/knowledge',
        icon: 'BookOpen',
        minRole: 'member',
      },
      {
        key: 'member-community',
        label: 'Community',
        to: '/member/community',
        icon: 'Globe',
        minRole: 'member',
      },
    ],
  },
  {
    key: 'operator-console',
    title: 'Operator',
    scope: 'primary',
    position: 70,
    items: [
      {
        key: 'operator-queue',
        label: 'Support Queue',
        to: '/operator/queue',
        icon: 'Inbox',
        minRole: 'operator',
      },
      {
        key: 'operator-knowledge',
        label: 'Knowledge',
        to: '/operator/knowledge',
        icon: 'BookOpen',
        minRole: 'operator',
      },
      {
        key: 'operator-community',
        label: 'Moderation',
        to: '/operator/community',
        icon: 'MessageSquare',
        minRole: 'operator',
      },
      {
        key: 'operator-analytics',
        label: 'Analytics',
        to: '/operator/analytics',
        icon: 'BarChart3',
        minRole: 'operator',
      },
      {
        key: 'operator-users',
        label: 'Users',
        to: '/operator/users',
        icon: 'Users',
        minRole: 'operator',
      },
    ],
  },
]

export default customRoutes
