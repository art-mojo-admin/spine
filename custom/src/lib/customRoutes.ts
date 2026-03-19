import { customRoutes } from '../routes'

export function getCustomRoutes() {
  return customRoutes
}

export type RouteConfig = {
  path: string
  loader: () => Promise<{ default: React.ComponentType }>
  minRole: 'member' | 'operator' | 'admin'
}
