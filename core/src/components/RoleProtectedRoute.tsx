import type { ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export type MinRole = 'portal' | 'member' | 'operator' | 'admin'

// Matches the ROLE_RANK in Sidebar.tsx — system_admin/system_operator outrank all account roles
export const ROLE_RANK: Record<string, number> = {
  portal: 0,
  member: 1,
  operator: 2,
  admin: 3,
  system_admin: 4,
  system_operator: 4,
}

interface RoleProtectedRouteProps {
  children?: ReactNode
  minRole?: MinRole
  redirectTo?: string
}

/**
 * Role-based access control for Spine v2.
 *
 * Usage 1 — layout route (groups of routes):
 *   <Route element={<RoleProtectedRoute minRole="admin" />}>
 *     <Route path="/admin/settings" element={<SettingsPage />} />
 *   </Route>
 *
 * Usage 2 — inline wrapper (single route element):
 *   <Route path="/foo" element={<RoleProtectedRoute minRole="operator"><FooPage /></RoleProtectedRoute>} />
 *
 * Access check uses currentRole (account membership) falling back to
 * profile.system_role so that system_admin users always pass.
 */
export function RoleProtectedRoute({ children, minRole, redirectTo = '/admin/system-health' }: RoleProtectedRouteProps) {
  const { profile, currentRole } = useAuth()

  const effectiveRole = currentRole ?? profile?.system_role ?? 'member'
  const userRank = ROLE_RANK[effectiveRole] ?? 1
  const requiredRank = ROLE_RANK[minRole ?? 'member'] ?? 1

  if (userRank < requiredRank) {
    return <Navigate to={redirectTo} replace />
  }

  // Layout-route mode: no children → render nested routes via Outlet
  return children ? <>{children}</> : <Outlet />
}
