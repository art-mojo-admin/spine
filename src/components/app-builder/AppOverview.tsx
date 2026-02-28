import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Navigation, Database, Zap, LayoutGrid, Eye } from 'lucide-react'
import { LucideIconDisplay } from './LucideIconPicker'
import type { AppDef, Selection } from '@/pages/admin/AppBuilder'

interface AppOverviewProps {
  app: AppDef
  selection: Selection
  viewDefs: any[]
  customFields: any[]
  automationRules: any[]
}

export function AppOverview({
  app,
  selection,
  viewDefs,
  customFields,
  automationRules,
}: AppOverviewProps) {
  // General: show app overview + nav preview
  if (selection.type === 'general') {
    return (
      <div className="space-y-6">
        {/* App Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <LucideIconDisplay name={app.icon} className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{app.name}</CardTitle>
                <p className="text-sm text-muted-foreground font-mono">{app.slug}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant={app.is_active ? 'default' : 'secondary'}>
                  {app.is_active ? 'Active' : 'Draft'}
                </Badge>
                {app.ownership === 'pack' && <Badge variant="outline">Pack</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {app.description && <p className="text-sm text-muted-foreground mb-4">{app.description}</p>}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <Navigation className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{app.nav_items.length}</p>
                <p className="text-[10px] text-muted-foreground">Nav Items</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Database className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{customFields.length}</p>
                <p className="text-[10px] text-muted-foreground">Custom Fields</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Zap className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-2xl font-bold">{automationRules.length}</p>
                <p className="text-[10px] text-muted-foreground">Automations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nav Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" /> Navigation Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {app.nav_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nav items yet. Add items in the tree panel.</p>
            ) : (
              <div className="w-56 rounded-lg border bg-card p-2 space-y-0.5">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {app.name}
                </p>
                {app.nav_items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                  >
                    <LucideIconDisplay name={item.icon} className="h-3.5 w-3.5" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Nav Item selected: show item details + linked view info
  if (selection.type === 'nav_item' && selection.index !== undefined) {
    const item = app.nav_items[selection.index]
    if (!item) return null

    const linkedView = item.view_slug
      ? viewDefs.find((v: any) => v.slug === item.view_slug)
      : null

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <LucideIconDisplay name={item.icon} className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{item.label}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {item.route_type === 'view' && item.view_slug && <span>→ /v/{item.view_slug}</span>}
                  {item.route_type === 'path' && item.url && <span>→ {item.url}</span>}
                  {item.route_type === 'external' && item.url && <span>→ {item.url}</span>}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Badge variant="outline" className="text-[10px]">{item.route_type}</Badge>
                <Badge variant="secondary" className="text-[10px]">min: {item.min_role}</Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {linkedView && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> Linked View: {linkedView.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary">{linkedView.view_type}</Badge>
                {linkedView.target_type && <Badge variant="outline">{linkedView.target_type}</Badge>}
                <code className="text-[10px] text-muted-foreground font-mono">{linkedView.slug}</code>
              </div>
              {linkedView.target_filter && Object.keys(linkedView.target_filter).length > 0 && (
                <pre className="rounded bg-muted p-2 text-[10px] font-mono overflow-auto">
                  {JSON.stringify(linkedView.target_filter, null, 2)}
                </pre>
              )}
              {linkedView.config?.panels?.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {linkedView.config.panels.length} panel{linkedView.config.panels.length !== 1 ? 's' : ''} configured
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {item.route_type === 'view' && !linkedView && item.view_slug && (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                View <code className="bg-muted px-1.5 rounded text-xs">{item.view_slug}</code> not found.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create it via the inspector panel or change the view slug.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Fields selected
  if (selection.type === 'fields') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Custom Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {customFields.length} custom field{customFields.length !== 1 ? 's' : ''} defined across all entity types.
            Use the inspector panel to create and manage fields.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Automations selected
  if (selection.type === 'automations') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" /> Automations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {automationRules.length} automation rule{automationRules.length !== 1 ? 's' : ''} configured.
            Use the inspector panel to create and manage rules.
          </p>
        </CardContent>
      </Card>
    )
  }

  return null
}
