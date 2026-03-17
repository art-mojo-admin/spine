import type { ComponentType } from 'react'

export type CustomRouteLayout = 'shell' | 'portal' | 'public'

export interface CustomRouteDefinition {
  /** Absolute path that should be registered with React Router */
  path: string
  /** Loader used to lazily import the route component */
  loader: () => Promise<{ default: ComponentType<any> }>
  /** Target layout; defaults to `shell` when omitted */
  layout?: CustomRouteLayout
  /** Minimum role required for nav scaffolding (informational) */
  minRole?: 'portal' | 'member' | 'operator' | 'admin'
  /** Optional description for tooling/docs */
  description?: string
}

export type CustomNavScope = 'admin' | 'primary'

export interface CustomNavItem {
  key: string
  label: string
  to: string
  /** Icon identifier matching a registered Lucide icon (e.g., "Users") */
  icon?: string
  minRole?: 'member' | 'operator' | 'admin'
}

export interface CustomNavSection {
  key: string
  title: string
  items: CustomNavItem[]
  scope?: CustomNavScope
  position?: number
}
