import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Copy, Plus, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react'
import { WIDGET_TYPE_MAP } from '@/lib/widgetRegistry'
import { LucideIconDisplay } from '@/components/app-builder/LucideIconPicker'
import { DataSourceEditor } from './DataSourceEditor'
import { ChartConfigEditor } from './ChartConfigEditor'
import { NavConfigEditor } from './NavConfigEditor'
import { StyleEditor } from './StyleEditor'
import type {
  WidgetConfig,
  DataSourceConfig,
  ChartConfig,
  NavConfig,
  ContentConfig,
  EmbedConfig,
  TabsConfig,
  AccordionConfig,
} from '@/lib/widgetRegistry'
import type { BuilderScope } from '@/lib/pageBuilderUtils'

const MIN_ROLES = [
  { value: 'portal', label: 'Portal' },
  { value: 'member', label: 'Member' },
  { value: 'operator', label: 'Operator' },
  { value: 'admin', label: 'Admin' },
]

interface WidgetInspectorProps {
  widget: WidgetConfig
  onUpdate: (updates: Partial<WidgetConfig>) => void
  onRemove: () => void
  onDuplicate: () => void
  scopeStack: BuilderScope[]
  onEnterChildScope?: (scope: BuilderScope) => void
}

export function WidgetInspector({ widget, onUpdate, onRemove, onDuplicate, onEnterChildScope }: WidgetInspectorProps) {
  const def = WIDGET_TYPE_MAP.get(widget.widget_type)

  return (
    <div className="w-[320px] flex-shrink-0 border-l bg-background overflow-y-auto">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <LucideIconDisplay name={def?.icon} className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">{def?.label || widget.widget_type}</p>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono">{widget.widget_type}</Badge>
      </div>

      <div className="p-4 space-y-5">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={widget.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Widget title"
          />
        </div>

        {/* Visibility */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Min Role</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={widget.visibility?.min_role || 'member'}
            onChange={(e) => onUpdate({ visibility: { ...widget.visibility, min_role: e.target.value } })}
          >
            {MIN_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Data Source (for data-driven widgets) */}
        {def?.hasDataSource && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Source</label>
            <DataSourceEditor
              value={widget.data_source || { entity: 'items', aggregate: 'count' }}
              onChange={(ds: DataSourceConfig) => onUpdate({ data_source: ds })}
            />
          </div>
        )}

        {/* Chart Config */}
        {widget.widget_type === 'chart' && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chart</label>
            <ChartConfigEditor
              value={widget.chart_config || { type: 'bar' }}
              onChange={(cc: ChartConfig) => onUpdate({ chart_config: cc })}
              availableLayers={(widget.data_source?.layers || []).map((layer) => layer.label).filter((label): label is string => Boolean(label))}
            />
          </div>
        )}

        {/* Content Config */}
        {(widget.widget_type === 'content' || widget.widget_type === 'heading') && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</label>
            <Textarea
              value={widget.content_config?.body || ''}
              onChange={(e) => onUpdate({ content_config: { format: 'markdown', body: e.target.value } as ContentConfig })}
              rows={widget.widget_type === 'heading' ? 2 : 8}
              placeholder={widget.widget_type === 'heading' ? 'Heading text...' : 'Markdown content...'}
              className="font-mono text-xs"
            />
          </div>
        )}

        {/* Nav Config */}
        {(widget.widget_type === 'nav_tree' || widget.widget_type === 'link_list') && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</label>
            <NavConfigEditor
              value={widget.nav_config || { items: [] }}
              onChange={(nc: NavConfig) => onUpdate({ nav_config: nc })}
            />
          </div>
        )}

        {/* Tabs Config */}
        {widget.widget_type === 'tabs' && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tabs</label>
            <TabsStructureEditor
              value={widget.tabs_config}
              onChange={(config) => onUpdate({ tabs_config: config })}
              onEnterTab={(index) => onEnterChildScope?.({ kind: 'tabs', widgetId: widget.id, tabIndex: index })}
            />
          </div>
        )}

        {/* Accordion Config */}
        {widget.widget_type === 'accordion' && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accordion</label>
            <AccordionStructureEditor
              value={widget.accordion_config}
              onChange={(config) => onUpdate({ accordion_config: config })}
              onEnterItem={(index) => onEnterChildScope?.({ kind: 'accordion', widgetId: widget.id, itemIndex: index })}
            />
          </div>
        )}

        {/* Embed Config */}
        {widget.widget_type === 'view_embed' && (
          <div className="space-y-1 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Embed</label>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">View Slug</label>
              <Input
                value={widget.embed_config?.view_slug || ''}
                onChange={(e) => onUpdate({ embed_config: { view_slug: e.target.value } as EmbedConfig })}
                placeholder="e.g. deal-pipeline"
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* Style Config */}
        <div className="space-y-1 border-t pt-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Style</label>
          <StyleEditor
            value={widget.style}
            onChange={(style) => onUpdate({ style })}
          />
        </div>

        {/* Actions */}
        <div className="border-t pt-4 flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={onDuplicate}>
            <Copy className="mr-1 h-3 w-3" /> Duplicate
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={onRemove}>
            <Trash2 className="mr-1 h-3 w-3" /> Remove
          </Button>
        </div>
      </div>
    </div>
  )
}
