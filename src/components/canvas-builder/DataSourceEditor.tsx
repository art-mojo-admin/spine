import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Layers } from 'lucide-react'
import { apiPost } from '@/lib/api'
import type { DataSourceConfig } from '@/lib/widgetRegistry'
import type { WidgetDataResult } from '@/components/page-renderer/useWidgetData'

const ENTITIES = [
  { value: 'items', label: 'Items' },
  { value: 'persons', label: 'Persons' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'activity_events', label: 'Activity Events' },
  { value: 'entity_links', label: 'Entity Links' },
  { value: 'memberships', label: 'Memberships' },
]

const AGGREGATES = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

const TIME_RANGES = [
  { value: '', label: 'All time' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'Year to date' },
]

const GROUP_BY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  items: [
    { value: '', label: '— None —' },
    { value: 'item_type', label: 'Item Type' },
    { value: 'priority', label: 'Priority' },
    { value: 'stage_definitions.name', label: 'Stage' },
    { value: 'workflow_definitions.name', label: 'Workflow' },
    { value: 'created_at:day', label: 'Created (Day)' },
    { value: 'created_at:week', label: 'Created (Week)' },
    { value: 'created_at:month', label: 'Created (Month)' },
  ],
  persons: [
    { value: '', label: '— None —' },
    { value: 'status', label: 'Status' },
    { value: 'created_at:month', label: 'Created (Month)' },
  ],
  accounts: [
    { value: '', label: '— None —' },
    { value: 'created_at:month', label: 'Created (Month)' },
  ],
  activity_events: [
    { value: '', label: '— None —' },
    { value: 'event_type', label: 'Event Type' },
    { value: 'entity_type', label: 'Entity Type' },
    { value: 'created_at:day', label: 'Created (Day)' },
    { value: 'created_at:month', label: 'Created (Month)' },
  ],
  entity_links: [
    { value: '', label: '— None —' },
    { value: 'link_type', label: 'Link Type' },
    { value: 'source_type', label: 'Source Type' },
    { value: 'target_type', label: 'Target Type' },
  ],
  memberships: [
    { value: '', label: '— None —' },
    { value: 'account_role', label: 'Role' },
    { value: 'status', label: 'Status' },
  ],
}

interface DataSourceEditorProps {
  value: DataSourceConfig
  onChange: (ds: DataSourceConfig) => void
}

export function DataSourceEditor({ value, onChange }: DataSourceEditorProps) {
  const [showFilters, setShowFilters] = useState(Object.keys(value.filters || {}).length > 0)
  const [newFilterKey, setNewFilterKey] = useState('')
  const [newFilterValue, setNewFilterValue] = useState('')
  const [previewState, setPreviewState] = useState<{ loading: boolean; data: WidgetDataResult | null; error: string | null }>({
    loading: false,
    data: null,
    error: null,
  })

  const filters = value.filters || {}
  const groupByOptions = GROUP_BY_OPTIONS[value.entity] || GROUP_BY_OPTIONS.items

  function update(partial: Partial<DataSourceConfig>) {
    onChange({ ...value, ...partial })
  }

  function addFilter() {
    if (!newFilterKey.trim()) return
    const newFilters = { ...filters, [newFilterKey.trim()]: newFilterValue.trim() || '' }
    update({ filters: newFilters })
    setNewFilterKey('')
    setNewFilterValue('')
  }

  function removeFilter(key: string) {
    const newFilters = { ...filters }
    delete newFilters[key]
    update({ filters: Object.keys(newFilters).length > 0 ? newFilters : undefined })
  }

  function addLayer() {
    const layers = value.layers ? [...value.layers] : []
    layers.push({ label: `Layer ${layers.length + 1}`, time_range: value.time_range || '30d', time_offset: '-30d' })
    update({ layers })
  }

  function updateLayer(index: number, partial: Partial<NonNullable<DataSourceConfig['layers']>[number]>) {
    const layers = value.layers ? [...value.layers] : []
    if (!layers[index]) return
    layers[index] = { ...layers[index], ...partial }
    update({ layers })
  }

  function removeLayer(index: number) {
    const layers = value.layers ? [...value.layers] : []
    layers.splice(index, 1)
    update({ layers: layers.length > 0 ? layers : undefined })
  }

  async function previewData() {
    if (!value.entity) return
    setPreviewState({ loading: true, data: previewState.data, error: null })
    try {
      const result = await apiPost<WidgetDataResult>('widget-data', value)
      setPreviewState({ loading: false, data: result, error: null })
    } catch (err: any) {
      setPreviewState({ loading: false, data: null, error: err?.message || 'Failed to load preview' })
    }
  }

  const aggregateBase = value.aggregate?.includes(':') ? value.aggregate.split(':')[0] : value.aggregate || 'count'
  const aggregateField = value.aggregate?.includes(':') ? value.aggregate.split(':')[1] : ''
  const needsField = ['sum', 'avg', 'min', 'max'].includes(aggregateBase)

  return (
    <div className="space-y-3">
      {/* Entity */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Entity</label>
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={value.entity}
          onChange={(e) => update({ entity: e.target.value, group_by: undefined, filters: undefined })}
        >
          {ENTITIES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      {/* Filters */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Filters</label>
          <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide' : 'Show'}
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-2">
            {/* Existing filters */}
            {Object.entries(filters).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[9px] font-mono">{key}</Badge>
                <span className="text-[10px] text-muted-foreground">=</span>
                <Badge variant="outline" className="text-[9px] font-mono">
                  {String(val) === '$me' ? (
                    <span className="text-purple-600">{String(val)}</span>
                  ) : String(val)}
                </Badge>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => removeFilter(key)}>
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}

            {/* Add filter */}
            <div className="flex gap-1">
              <Input
                value={newFilterKey}
                onChange={(e) => setNewFilterKey(e.target.value)}
                placeholder="field"
                className="text-xs h-7 flex-1 font-mono"
              />
              <Input
                value={newFilterValue}
                onChange={(e) => setNewFilterValue(e.target.value)}
                placeholder="value"
                className="text-xs h-7 flex-1 font-mono"
                onKeyDown={(e) => e.key === 'Enter' && addFilter()}
              />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={addFilter}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground">
              Use <code className="text-purple-600">$me</code> for current user, <code className="text-purple-600">$today</code> for today
            </p>
          </div>
        )}
      </div>

      {/* Group By */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Group By</label>
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={value.group_by || ''}
          onChange={(e) => update({ group_by: e.target.value || undefined })}
        >
          {groupByOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>

      {/* Aggregate */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Aggregate</label>
        <div className="flex gap-1">
          <select
            className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
            value={aggregateBase}
            onChange={(e) => {
              const base = e.target.value
              if (['sum', 'avg', 'min', 'max'].includes(base)) {
                update({ aggregate: `${base}:${aggregateField || 'metadata.value'}` })
              } else {
                update({ aggregate: base })
              }
            }}
          >
            {AGGREGATES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          {needsField && (
            <Input
              value={aggregateField}
              onChange={(e) => update({ aggregate: `${aggregateBase}:${e.target.value}` })}
              placeholder="field"
              className="flex-1 text-xs h-auto font-mono"
            />
          )}
        </div>
      </div>

      {/* Time Range */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Time Range</label>
        <div className="flex flex-wrap gap-1">
          {TIME_RANGES.map((tr) => (
            <button
              key={tr.value}
              className={`rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                (value.time_range || '') === tr.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
              onClick={() => update({ time_range: tr.value || undefined })}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Layers */}
      <div className="space-y-2 border rounded-md p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-3 w-3 text-muted-foreground" />
            <label className="text-xs font-semibold text-muted-foreground">Comparison Layers</label>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={addLayer}>
            Add Layer
          </Button>
        </div>
        {!(value.layers && value.layers.length) && (
          <p className="text-[10px] text-muted-foreground">Add comparison layers to overlay previous periods.</p>
        )}
        <div className="space-y-2">
          {value.layers?.map((layer, idx) => (
            <div key={idx} className="rounded-md border p-2 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <Input
                  value={layer.label}
                  onChange={(e) => updateLayer(idx, { label: e.target.value })}
                  placeholder="Label"
                  className="text-xs font-medium"
                />
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeLayer(idx)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Time Range</label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                    value={layer.time_range || ''}
                    onChange={(e) => updateLayer(idx, { time_range: e.target.value || undefined })}
                  >
                    {TIME_RANGES.filter((tr) => tr.value).map((tr) => (
                      <option key={tr.value} value={tr.value}>{tr.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Time Offset</label>
                  <Input
                    value={layer.time_offset || ''}
                    onChange={(e) => updateLayer(idx, { time_offset: e.target.value || undefined })}
                    placeholder="-30d"
                    className="text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sort & Limit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Sort</label>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            value={value.sort || ''}
            onChange={(e) => update({ sort: e.target.value || undefined })}
          >
            <option value="">Default</option>
            <option value="value:desc">Value ↓</option>
            <option value="value:asc">Value ↑</option>
            <option value="count:desc">Count ↓</option>
            <option value="count:asc">Count ↑</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Limit</label>
          <Input
            type="number"
            value={value.limit || ''}
            onChange={(e) => update({ limit: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            placeholder="All"
            className="text-xs"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</label>
          <Button size="sm" variant="outline" className="text-xs"
            onClick={previewData}
            disabled={previewState.loading}
          >
            {previewState.loading ? 'Loading...' : 'Preview Data'}
          </Button>
        </div>
        {previewState.error && (
          <p className="text-[11px] text-destructive">{previewState.error}</p>
        )}
        {previewState.data && (
          <div className="space-y-3">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Group</th>
                    <th className="px-2 py-1 text-right font-medium">Value</th>
                    <th className="px-2 py-1 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {previewState.data.rows.map((row) => (
                    <tr key={row.group} className="border-t">
                      <td className="px-2 py-1 font-mono">{row.group}</td>
                      <td className="px-2 py-1 text-right">{row.value}</td>
                      <td className="px-2 py-1 text-right text-muted-foreground">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-2 py-1 text-[10px] text-muted-foreground border-t">Total rows: {previewState.data.total}</div>
            </div>

            {previewState.data.layers?.map((layer) => (
              <div key={layer.label} className="rounded-md border overflow-hidden">
                <div className="px-2 py-1 text-[11px] font-semibold bg-muted/50">{layer.label}</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Group</th>
                      <th className="px-2 py-1 text-right font-medium">Value</th>
                      <th className="px-2 py-1 text-right font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layer.rows.map((row) => (
                      <tr key={`${layer.label}-${row.group}`} className="border-t">
                        <td className="px-2 py-1 font-mono">{row.group}</td>
                        <td className="px-2 py-1 text-right">{row.value}</td>
                        <td className="px-2 py-1 text-right text-muted-foreground">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
