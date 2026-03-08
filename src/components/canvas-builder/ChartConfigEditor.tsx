import { DEFAULT_CHART_COLORS } from '@/lib/widgetRegistry'
import type { ChartConfig, ChartSeriesConfig } from '@/lib/widgetRegistry'

const CHART_TYPES: { value: ChartConfig['type']; label: string; icon: string }[] = [
  { value: 'bar', label: 'Bar', icon: '▊▊▋' },
  { value: 'line', label: 'Line', icon: '╱╲╱' },
  { value: 'area', label: 'Area', icon: '▓▓▒' },
  { value: 'pie', label: 'Pie', icon: '◔◑◕' },
  { value: 'funnel', label: 'Funnel', icon: '▽▿▵' },
  { value: 'scatter', label: 'Scatter', icon: '∴∵∶' },
]

const X_KEY_OPTIONS: { value: NonNullable<ChartConfig['x_key']>; label: string }[] = [
  { value: 'name', label: 'Group' },
  { value: 'value', label: 'Value' },
  { value: 'count', label: 'Count' },
]

const SERIES_FIELDS: { value: ChartSeriesConfig['field']; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'count', label: 'Count' },
]

interface ChartConfigEditorProps {
  value: ChartConfig
  onChange: (cc: ChartConfig) => void
  availableLayers?: string[]
}

export function ChartConfigEditor({ value, onChange, availableLayers = [] }: ChartConfigEditorProps) {
  function update(partial: Partial<ChartConfig>) {
    onChange({ ...value, ...partial })
  }

  const supportsMultiSeries = ['bar', 'line', 'area'].includes(value.type)
  const baseSeries: ChartSeriesConfig[] = (value.series && value.series.length > 0)
    ? value.series
    : [{ id: 'series_primary', label: 'Series 1', source: 'primary', field: 'value' }]
  const seriesToRender = supportsMultiSeries ? baseSeries : [baseSeries[0]]

  function updateSeries(seriesId: string, partial: Partial<ChartSeriesConfig>) {
    const next = baseSeries.map((series) =>
      series.id === seriesId ? { ...series, ...partial } : series,
    )
    update({ series: next })
  }

  function addSeries() {
    if (!supportsMultiSeries) return
    const next: ChartSeriesConfig = {
      id: `series_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `Series ${baseSeries.length + 1}`,
      source: availableLayers.length > 0 ? 'layer' : 'primary',
      layer_label: availableLayers[0],
      field: 'value',
    }
    update({ series: [...baseSeries, next] })
  }

  function removeSeries(seriesId: string) {
    if (!supportsMultiSeries) return
    if (baseSeries.length <= 1) return
    update({ series: baseSeries.filter((series) => series.id !== seriesId) })
  }

  return (
    <div className="space-y-3">
      {/* Chart type */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Chart Type</label>
        <div className="grid grid-cols-3 gap-1">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              className={`rounded-md border px-2 py-2 text-center transition-colors ${
                value.type === ct.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              }`}
              onClick={() => update({ type: ct.value })}
            >
              <div className="text-sm leading-none mb-0.5">{ct.icon}</div>
              <div className="text-[10px] font-medium">{ct.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Axis (only for cartesian charts) */}
      {supportsMultiSeries && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Horizontal Axis</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-xs"
            value={value.x_key || 'name'}
            onChange={(e) => update({ x_key: e.target.value as ChartConfig['x_key'] })}
          >
            {X_KEY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Options */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value.stacked || false}
            onChange={(e) => update({ stacked: e.target.checked })}
            className="h-3.5 w-3.5 rounded border"
          />
          Stacked
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value.show_legend || false}
            onChange={(e) => update({ show_legend: e.target.checked })}
            className="h-3.5 w-3.5 rounded border"
          />
          Show Legend
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value.show_grid !== false}
            onChange={(e) => update({ show_grid: e.target.checked })}
            className="h-3.5 w-3.5 rounded border"
          />
          Show Grid Lines
        </label>
      </div>

      {/* Series Builder */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Series</label>
          <button
            type="button"
            className="text-[11px] font-medium text-primary disabled:text-muted-foreground"
            onClick={addSeries}
            disabled={!supportsMultiSeries}
          >
            Add Series
          </button>
        </div>
        <div className="space-y-2">
          {seriesToRender.map((series, idx) => (
            <div key={series.id} className="rounded-md border p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={series.label}
                  onChange={(e) => updateSeries(series.id, { label: e.target.value })}
                  className="flex-1 rounded-md border px-2 py-1 text-xs"
                  placeholder={`Series ${idx + 1}`}
                />
                {supportsMultiSeries && (
                  <button
                    type="button"
                    className="text-[11px] text-destructive"
                    onClick={() => removeSeries(series.id)}
                    disabled={baseSeries.length <= 1}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Source</label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1"
                    value={series.source}
                    onChange={(e) => updateSeries(series.id, { source: e.target.value as ChartSeriesConfig['source'] })}
                  >
                    <option value="primary">Primary</option>
                    <option value="layer" disabled={availableLayers.length === 0}>Layer</option>
                  </select>
                </div>
                {series.source === 'layer' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Layer</label>
                    <select
                      className="w-full rounded-md border bg-background px-2 py-1"
                      value={series.layer_label || ''}
                      onChange={(e) => updateSeries(series.id, { layer_label: e.target.value })}
                    >
                      {availableLayers.length === 0 && <option value="">No layers</option>}
                      {availableLayers.map((layer) => (
                        <option key={layer} value={layer}>{layer}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Field</label>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1"
                    value={series.field}
                    onChange={(e) => updateSeries(series.id, { field: e.target.value as ChartSeriesConfig['field'] })}
                  >
                    {SERIES_FIELDS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Color</label>
                  <input
                    type="color"
                    value={series.color || (value.colors || DEFAULT_CHART_COLORS)[idx % DEFAULT_CHART_COLORS.length]}
                    onChange={(e) => updateSeries(series.id, { color: e.target.value })}
                    className="h-8 w-full rounded-md border"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Palette fallback */}
      <div className="space-y-1 border-t pt-3">
        <label className="text-xs font-medium text-muted-foreground">Palette</label>
        <div className="flex flex-wrap gap-1">
          {(value.colors || DEFAULT_CHART_COLORS).slice(0, 6).map((color, i) => (
            <label key={i} className="relative cursor-pointer">
              <div
                className="h-6 w-6 rounded-md border-2 border-background shadow-sm"
                style={{ backgroundColor: color }}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  const newColors = [...(value.colors || DEFAULT_CHART_COLORS)]
                  newColors[i] = e.target.value
                  update({ colors: newColors })
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
