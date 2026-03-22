import { RouteConfig } from '@/lib/customRoutes'

// Member routes (all require authentication)
export const memberRoutes: RouteConfig[] = [
  {
    path: '/member',
    loader: () => import('./member/pages/MemberDashboardPage').then(m => ({ default: m.default })),
    minRole: 'member'
  },
  {
    path: '/member/knowledge',
    loader: () => import('./member/pages/KnowledgePage').then(m => ({ default: m.default })),
    minRole: 'member'
  },
  {
    path: '/member/knowledge/:articleId',
    loader: () => import('./member/pages/KnowledgeArticlePage').then(m => ({ default: m.default })),
    minRole: 'member'
  },
  {
    path: '/member/support',
    loader: () => import('./member/pages/SupportPage').then(m => ({ default: m.default })),
    minRole: 'member'
  },
  {
    path: '/member/support/cases/:caseId',
    loader: () => import('./member/pages/SupportCasesPage').then(m => ({ default: m.default })),
    minRole: 'member'
  },
  {
    path: '/member/community',
    loader: () => import('./member/pages/CommunityPage').then(m => ({ default: m.default })),
    minRole: 'member'
  },
  {
    path: '/member/community/:postId',
    loader: () => import('./member/pages/CommunityPostPage').then(m => ({ default: m.default })),
    minRole: 'member'
  }
]

// Operator routes (require operator or admin role)
export const operatorRoutes: RouteConfig[] = [
  {
    path: '/operator',
    loader: () => import('./operator/pages/OperatorDashboardPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/queue',
    loader: () => import('./operator/pages/SupportQueuePage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/cases/:caseId',
    loader: () => import('./operator/pages/CaseWorkspacePage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/knowledge',
    loader: () => import('./operator/pages/KnowledgeListPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/knowledge/:articleId',
    loader: () => import('./operator/pages/KnowledgeEditorPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/knowledge/new',
    loader: () => import('./operator/pages/KnowledgeEditorPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/community',
    loader: () => import('./operator/pages/CommunityModerationPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/analytics',
    loader: () => import('./operator/pages/AnalyticsPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  },
  {
    path: '/operator/users',
    loader: () => import('./operator/pages/UsersPage').then(m => ({ default: m.default })),
    minRole: 'operator'
  }
]

// All custom routes
export const customRoutes = [...memberRoutes, ...operatorRoutes]

export default customRoutes
