import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield } from 'lucide-react'

export function RolesPage() {
  const { profile, memberships, currentAccountId, currentRole } = useAuth()

  const accountRoles = [
    { role: 'admin', desc: 'Full access to tenant resources, settings, and member management' },
    { role: 'operator', desc: 'Manage workflows, tickets, and KB articles' },
    { role: 'member', desc: 'Read access with limited write capabilities' },
  ]

  const systemRoles = [
    { role: 'system_admin', desc: 'Cross-tenant administration and full system access' },
    { role: 'system_operator', desc: 'Cross-tenant read access for operational support' },
    { role: 'support_operator', desc: 'Support ticket access across tenants' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="mt-1 text-muted-foreground">RBAC overview for your account</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Current Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Account Role:</span>
            <Badge>{currentRole || '—'}</Badge>
          </div>
          {profile?.system_role && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">System Role:</span>
              <Badge variant="secondary">{profile.system_role}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Roles</CardTitle>
          <CardDescription>Tenant-level roles assigned via memberships</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accountRoles.map(({ role, desc }) => (
              <div key={role} className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium capitalize">{role}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Roles</CardTitle>
          <CardDescription>Global roles for cross-tenant operations (assigned via profiles)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemRoles.map(({ role, desc }) => (
              <div key={role} className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{role.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
