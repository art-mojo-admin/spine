import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Shield, Info, Key } from 'lucide-react'

export function RolesPage() {
  const { profile, memberships, currentAccountId, currentRole } = useAuth()

  const adminScopes = [
    { scope: 'admin.members', desc: 'Manage memberships, invites, principals, and tenant roles' },
    { scope: 'admin.settings', desc: 'Configure tenant settings, themes, and account configuration' },
    { scope: 'admin.automations', desc: 'Create and manage automation rules, workflows, schedules, and custom actions' },
    { scope: 'admin.webhooks', desc: 'Configure webhook subscriptions, inbound hooks, and view delivery logs' },
    { scope: 'admin.integrations', desc: 'Manage integrations, apps, agent capabilities, and extension surfaces' },
    { scope: 'admin.items', desc: 'Configure item types, stage/view/transition definitions, and item schemas' },
    { scope: 'admin.audit', desc: 'View audit logs and system activity' },
    { scope: 'admin.packs', desc: 'Manage pack lifecycle, config packs, and local manifests' },
  ]

  const systemRoles = [
    { role: 'system_admin', desc: 'Cross-tenant administration and full system access' },
    { role: 'system_operator', desc: 'Cross-tenant read access for operational support' },
    { role: 'support_operator', desc: 'Support ticket access across tenants' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roles & Scopes</h1>
        <p className="mt-1 text-muted-foreground">Scope-based authorization overview for your account</p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="system-roles">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span className="font-medium">Understanding System Roles</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold">Purpose</h4>
                <p className="text-muted-foreground">System roles provide cross-tenant administrative access and are assigned directly to user profiles by system administrators.</p>
              </div>
              <div>
                <h4 className="font-semibold">Configuration</h4>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><strong>system_admin:</strong> Full system access across all tenants, can manage accounts and users</li>
                  <li><strong>system_operator:</strong> Read-only access across all tenants for operational support</li>
                  <li><strong>support_operator:</strong> Access to support tickets across all tenants</li>
                </ul>
                <p className="text-muted-foreground mt-2">Only system admins can assign these roles through user profile management.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="admin-scopes">
          <AccordionTrigger className="text-left">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="font-medium">Understanding Admin Scopes</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold">Purpose</h4>
                <p className="text-muted-foreground">Admin scopes provide granular, permission-based access control within a tenant. Each scope grants access to specific administrative functions.</p>
              </div>
              <div>
                <h4 className="font-semibold">Configuration</h4>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><strong>admin.members:</strong> Manage memberships, invites, principals, and tenant roles</li>
                  <li><strong>admin.settings:</strong> Configure tenant settings, themes, and account configuration</li>
                  <li><strong>admin.automations:</strong> Create and manage automation rules, workflows, schedules, and custom actions</li>
                  <li><strong>admin.webhooks:</strong> Configure webhook subscriptions, inbound hooks, and view delivery logs</li>
                  <li><strong>admin.integrations:</strong> Manage integrations, apps, agent capabilities, and extension surfaces</li>
                  <li><strong>admin.items:</strong> Configure item types, stage/view/transition definitions, and item schemas</li>
                  <li><strong>admin.audit:</strong> View audit logs and system activity</li>
                  <li><strong>admin.packs:</strong> Manage pack lifecycle, config packs, and local manifests</li>
                </ul>
                <p className="text-muted-foreground mt-2">Assign these scopes to principals in the Principal Scopes page. System admins bypass all scope checks.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card>
        <CardHeader>
          <CardTitle>Your Current Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Account Role:</span>
            <Badge variant="outline">{currentRole || 'None (deprecated)'}</Badge>
          </div>
          {profile?.system_role && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">System Role:</span>
              <Badge variant="secondary">{profile.system_role}</Badge>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Principal Scopes:</span>
            <Badge variant="outline">View in Principal Scopes page</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Scopes</CardTitle>
          <CardDescription>Granular permissions for tenant administration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {adminScopes.map(({ scope, desc }) => (
              <div key={scope} className="flex items-start gap-3">
                <Key className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{scope}</p>
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
