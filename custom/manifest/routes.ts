import { customRoutes } from '../src/routes'
import { customNavSections } from './navSections'
import type { CustomRouteDefinition } from '@/lib/customRouteTypes'

// Transform our custom routes to the format expected by the core
const transformedRoutes: CustomRouteDefinition[] = customRoutes.map(route => ({
  path: route.path,
  component: route.loader,
  minRole: route.minRole
}))

export const customRoutes = transformedRoutes
export const customNavSections = customNavSections
export default transformedRoutes
