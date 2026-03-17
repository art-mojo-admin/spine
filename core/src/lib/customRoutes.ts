import type { CustomNavSection, CustomRouteDefinition } from './customRouteTypes'

interface ManifestModule {
  default?: CustomRouteDefinition[]
  customRoutes?: CustomRouteDefinition[]
  customNavSections?: CustomNavSection[]
}

const manifestModules = import.meta.glob<ManifestModule>('@custom/manifest/routes.ts', { eager: true })

let cachedRoutes: CustomRouteDefinition[] | null = null
let cachedNavSections: CustomNavSection[] | null = null

export function getCustomRoutes(): CustomRouteDefinition[] {
  if (cachedRoutes) return cachedRoutes

  const resolved: CustomRouteDefinition[] = []

  for (const mod of Object.values(manifestModules)) {
    if (!mod) continue
    if (Array.isArray(mod.customRoutes)) {
      resolved.push(...mod.customRoutes)
      continue
    }
    if (Array.isArray(mod.default)) {
      resolved.push(...mod.default)
    }
  }

  cachedRoutes = resolved
  return cachedRoutes
}

export function getCustomNavSections(): CustomNavSection[] {
  if (cachedNavSections) return cachedNavSections

  const resolved: CustomNavSection[] = []

  for (const mod of Object.values(manifestModules)) {
    if (!mod) continue
    if (Array.isArray(mod.customNavSections)) {
      resolved.push(...mod.customNavSections)
    }
  }

  cachedNavSections = resolved
  return cachedNavSections
}
