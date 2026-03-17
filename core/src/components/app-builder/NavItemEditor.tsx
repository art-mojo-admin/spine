import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'
import { LucideIconPicker } from './LucideIconPicker'
import type { NavItem } from '@/pages/admin/AppBuilder'

const ROUTE_TYPES = [
  { value: 'view', label: 'View' },
  { value: 'path', label: 'Path' },
  { value: 'external', label: 'External' },
]

const MIN_ROLES = [
  { value: 'portal', label: 'Portal' },
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

interface NavItemEditorProps {
  item: NavItem
  index: number
  viewDefs: any[]
  onChange: (index: number, partial: Partial<NavItem>) => void
  onRemove: (index: number) => void
}

export function NavItemEditor({ item, index, viewDefs, onChange, onRemove }: NavItemEditorProps) {
  const activeViews = viewDefs.filter((v: any) => v.is_active !== false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Nav Item</p>
        <Badge variant="outline" className="text-[10px] font-mono">#{index}</Badge>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Label</label>
        <Input
          value={item.label}
          onChange={(e) => onChange(index, { label: e.target.value })}
          placeholder="e.g. Dashboard"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Icon</label>
        <LucideIconPicker
          value={item.icon || null}
          onChange={(iconName) => onChange(index, { icon: iconName })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Route Type</label>
        <div className="flex gap-1">
          {ROUTE_TYPES.map((rt) => (
            <button
              key={rt.value}
              type="button"
              onClick={() => onChange(index, { route_type: rt.value })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                item.route_type === rt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:bg-accent border-border'
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {item.route_type === 'view' && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">View</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={item.view_slug || ''}
            onChange={(e) => onChange(index, { view_slug: e.target.value })}
          >
            <option value="">— Select View —</option>
            {activeViews.map((v: any) => (
              <option key={v.id} value={v.slug}>
                {v.name} ({v.view_type}) — {v.slug}
              </option>
            ))}
          </select>
          {item.view_slug && (
            <p className="text-[10px] text-muted-foreground">
              Routes to <code className="bg-muted px-1 rounded">/v/{item.view_slug}</code>
            </p>
          )}
        </div>
      )}

      {item.route_type === 'path' && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Internal Path</label>
          <Input
            value={item.url || ''}
            onChange={(e) => onChange(index, { url: e.target.value })}
            placeholder="/accounts, /admin/views, /workflows"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Any valid internal route path (e.g. /accounts, /admin/views)
          </p>
        </div>
      )}

      {item.route_type === 'external' && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">External URL</label>
          <Input
            value={item.url || ''}
            onChange={(e) => onChange(index, { url: e.target.value })}
            placeholder="https://..."
            className="font-mono text-xs"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Min Role</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={item.min_role || 'member'}
          onChange={(e) => onChange(index, { min_role: e.target.value })}
        >
          {MIN_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive text-xs"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="mr-1 h-3 w-3" /> Remove Nav Item
        </Button>
      </div>
    </div>
  )
}
