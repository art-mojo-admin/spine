import { createHandler, requireAuth, requireTenant, json, error } from './_shared/middleware'
import { db } from './_shared/db'

const ROLE_RANK: Record<string, number> = {
  portal: 0,
  member: 1,
  operator: 2,
  admin: 3,
}

interface NavItem {
  label: string
  icon?: string
  route_type: string  // 'view' | 'external' | 'admin'
  view_slug?: string
  url?: string
  position: number
  min_role: string
}

interface ComputedNavItem {
  app_slug: string
  app_name: string
  app_icon?: string
  label: string
  icon?: string
  route_type: string
  view_slug?: string
  url?: string
  position: number
}

export default createHandler({
  async GET(req, ctx, params) {
    const authCheck = requireAuth(ctx)
    if (authCheck) return authCheck
    const tenantCheck = requireTenant(ctx)
    if (tenantCheck) return tenantCheck

    // Allow admin to preview as a different role
    const previewRole = params.get('role')
    const effectiveRole = previewRole || ctx.accountRole || 'member'
    const userRank = ROLE_RANK[effectiveRole] ?? 1

    // Fetch all active app definitions for this account
    const { data: apps } = await db
      .from('app_definitions')
      .select('*')
      .eq('account_id', ctx.accountId)
      .eq('is_active', true)
      .order('name')

    if (!apps || apps.length === 0) {
      return json({ nav_items: [], apps: [] })
    }

    const navItems: ComputedNavItem[] = []
    const visibleApps: { slug: string; name: string; icon?: string }[] = []

    for (const app of apps) {
      const appMinRank = ROLE_RANK[app.min_role] ?? 1
      if (userRank < appMinRank) continue

      visibleApps.push({ slug: app.slug, name: app.name, icon: app.icon })

      const items: NavItem[] = app.nav_items || []
      for (const item of items) {
        const itemMinRank = ROLE_RANK[item.min_role || 'member'] ?? 1
        if (userRank < itemMinRank) continue

        navItems.push({
          app_slug: app.slug,
          app_name: app.name,
          app_icon: app.icon,
          label: item.label,
          icon: item.icon,
          route_type: item.route_type,
          view_slug: item.view_slug,
          url: item.url,
          position: item.position ?? 0,
        })
      }
    }

    // Sort by position
    navItems.sort((a, b) => a.position - b.position)

    return json({ nav_items: navItems, apps: visibleApps })
  },
})
