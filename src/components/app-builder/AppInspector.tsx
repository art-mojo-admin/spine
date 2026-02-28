import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LucideIconPicker } from './LucideIconPicker'
import { NavItemEditor } from './NavItemEditor'
import { ViewEditor } from './ViewEditor'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import { AutomationsEditor } from './AutomationsEditor'
import type { AppDef, NavItem, Selection } from '@/pages/admin/AppBuilder'

const MIN_ROLES = [
  { value: 'portal', label: 'Portal' },
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

interface AppInspectorProps {
  app: AppDef
  selection: Selection
  viewDefs: any[]
  customFields: any[]
  automationRules: any[]
  onUpdateApp: (partial: Partial<AppDef>) => void
  onUpdateNavItem: (index: number, partial: Partial<NavItem>) => void
  onRemoveNavItem: (index: number) => void
  onReloadData: () => void
}

export function AppInspector({
  app,
  selection,
  viewDefs,
  customFields,
  automationRules,
  onUpdateApp,
  onUpdateNavItem,
  onRemoveNavItem,
  onReloadData,
}: AppInspectorProps) {
  return (
    <div className="w-[380px] flex-shrink-0 border-l bg-background overflow-y-auto">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">
          {selection.type === 'general' && 'App Settings'}
          {selection.type === 'nav_item' && 'Nav Item'}
          {selection.type === 'view' && 'View Editor'}
          {selection.type === 'fields' && 'Custom Fields'}
          {selection.type === 'automations' && 'Automations'}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* General / App Metadata */}
        {selection.type === 'general' && (
          <GeneralEditor app={app} onUpdate={onUpdateApp} viewDefs={viewDefs} />
        )}

        {/* Nav Item */}
        {selection.type === 'nav_item' && selection.index !== undefined && app.nav_items[selection.index] && (
          <NavItemEditor
            item={app.nav_items[selection.index]}
            index={selection.index}
            viewDefs={viewDefs}
            onChange={onUpdateNavItem}
            onRemove={onRemoveNavItem}
          />
        )}

        {/* View Editor */}
        {selection.type === 'view' && selection.viewSlug && (
          <ViewEditor
            viewSlug={selection.viewSlug}
            viewDefs={viewDefs}
            onReload={onReloadData}
          />
        )}

        {/* Custom Fields */}
        {selection.type === 'fields' && (
          <CustomFieldsEditor
            customFields={customFields}
            onReload={onReloadData}
          />
        )}

        {/* Automations */}
        {selection.type === 'automations' && (
          <AutomationsEditor
            automationRules={automationRules}
            onReload={onReloadData}
          />
        )}
      </div>
    </div>
  )
}

function GeneralEditor({
  app,
  onUpdate,
  viewDefs,
}: {
  app: AppDef
  onUpdate: (partial: Partial<AppDef>) => void
  viewDefs: any[]
}) {
  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">App Name</label>
        <Input
          value={app.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g. CRM"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Slug</label>
        <Input
          value={app.slug}
          onChange={(e) => onUpdate({ slug: e.target.value })}
          placeholder="auto-generated"
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Icon</label>
        <LucideIconPicker
          value={app.icon}
          onChange={(iconName) => onUpdate({ icon: iconName })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea
          value={app.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value || null })}
          placeholder="What this app does..."
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Min Role</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={app.min_role}
          onChange={(e) => onUpdate({ min_role: e.target.value })}
        >
          {MIN_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground">
          Minimum role required to see this app in the sidebar.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Default View</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={app.default_view || ''}
          onChange={(e) => onUpdate({ default_view: e.target.value || null })}
        >
          <option value="">— None —</option>
          {viewDefs
            .filter((v: any) => v.is_active !== false)
            .map((v: any) => (
              <option key={v.id} value={v.slug}>{v.name} ({v.slug})</option>
            ))}
        </select>
      </div>

      <div className="pt-2 border-t">
        <p className="text-[10px] text-muted-foreground">
          Ownership: <strong>{app.ownership || 'tenant'}</strong> · Created {new Date(app.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}
