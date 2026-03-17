import type { CustomNavSection, CustomRouteDefinition } from '@core/lib/customRouteTypes'

export const customRoutes: CustomRouteDefinition[] = [
  {
    path: '/custom/community',
    loader: () => import('../community/pages/CommunityHome').then(m => ({ default: m.CommunityHome })),
    layout: 'shell',
    minRole: 'member',
    description: 'Community home experience rendered inside the core shell.',
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
]

export default customRoutes
