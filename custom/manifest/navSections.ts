import type { CustomNavSection } from '@/lib/customRouteTypes'

export const customNavSections: CustomNavSection[] = [
  {
    key: 'member-apps',
    title: 'Member Apps',
    scope: 'primary',
    position: 10,
    items: [
      {
        key: 'knowledge',
        to: '/member/knowledge',
        label: 'Knowledge Base',
        icon: 'Search',
        minRole: 'member'
      },
      {
        key: 'support',
        to: '/member/support',
        label: 'Support',
        icon: 'MessageSquare',
        minRole: 'member'
      },
      {
        key: 'community',
        to: '/member/community',
        label: 'Community',
        icon: 'Users',
        minRole: 'member'
      }
    ]
  },
  {
    key: 'operator-tools',
    title: 'Operator Tools',
    scope: 'primary',
    position: 20,
    items: [
      {
        key: 'support-queue',
        to: '/operator/queue',
        label: 'Support Queue',
        icon: 'MessageSquare',
        minRole: 'operator'
      },
      {
        key: 'knowledge-mgmt',
        to: '/operator/knowledge',
        label: 'Knowledge Management',
        icon: 'Search',
        minRole: 'operator'
      },
      {
        key: 'community-moderation',
        to: '/operator/community',
        label: 'Community Moderation',
        icon: 'Users',
        minRole: 'operator'
      },
      {
        key: 'analytics',
        to: '/operator/analytics',
        label: 'Analytics',
        icon: 'Activity',
        minRole: 'operator'
      },
      {
        key: 'user-management',
        to: '/operator/users',
        label: 'User Management',
        icon: 'UserCheck',
        minRole: 'operator'
      }
    ]
  }
]

export default customNavSections
