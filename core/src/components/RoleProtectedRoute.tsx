import { useAuth } from '@/hooks/useAuth'
import { Navigate } from 'react-router-dom'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  minRole?: 'portal' | 'member' | 'operator' | 'admin'
}

export function RoleProtectedRoute({ children, minRole }: RoleProtectedRouteProps) {
  const { profile, currentRole } = useAuth()

  // Role ranking system (matches sidebar logic)
  const ROLE_RANK: Record<string, number> = {
    portal: 0,
    member: 1,
    operator: 2,
    admin: 3,
    system_admin: 4,
    system_operator: 4,
  }

  const userRank = ROLE_RANK[currentRole ?? profile?.system_role ?? 'member'] ?? 1
  const requiredRank = ROLE_RANK[minRole ?? 'member'] ?? 1

  if (userRank < requiredRank) {
    // Redirect to a page they can access, or show unauthorized
    return <Navigate to="/admin/system-health" replace />
  }

  return <>{children}</>
}
