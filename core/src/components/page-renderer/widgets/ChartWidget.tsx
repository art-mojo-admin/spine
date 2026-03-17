import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWidgetData } from '../useWidgetData'
import type { WidgetConfig, ChartSeriesConfig } from '@/lib/widgetRegistry'
import { DEFAULT_CHART_COLORS } from '@/lib/widgetRegistry'

interface ChartWidgetProps {
  config: WidgetConfig
}

export function ChartWidget({ config }: ChartWidgetProps) {
  const { data, loading, error } = useWidgetData(config.data_source)
  const cc = config.chart_config
  const chartType = cc?.type || 'bar'
  const palette = cc?.colors?.length ? cc.colors : DEFAULT_CHART_COLORS

  const seriesList: ChartSeriesConfig[] = useMemo(() => {
    if (cc?.series && cc.series.length > 0) return cc.series
    return [{ id: 'series_primary', label: config.title || 'Series', source: 'primary', field: 'value' }]
  }, [cc?.series, config.title])

  const layerMaps = useMemo(() => {
    const primary = new Map<string, { value: number; count: number }>()
    for (const row of data?.rows || []) {
      primary.set(row.group, { value: row.value, count: row.count })
    }

    const layers = new Map<string, Map<string, { value: number; count: number }>>()
    for (const layer of data?.layers || []) {
      const map = new Map<string, { value: number; count: number }>()
      for (const row of layer.rows) {
        map.set(row.group, { value: row.value, count: row.count })
      }
      layers.set(layer.label, map)
    }

    return { primary, layers }
  }, [data])

  const cartesianData = useMemo(() => {
    const map = new Map<string, any>()

    function ensureEntry(group: string) {
      const key = group === '_total' ? 'Total' : group
      if (!map.has(key)) {
        map.set(key, { name: key, value: 0, count: 0 })
      }
      return map.get(key)!
    }

    for (const [group, row] of layerMaps.primary.entries()) {
      const entry = ensureEntry(group)
      entry.value = row.value
      entry.count = row.count
    }

    for (const [, layer] of layerMaps.layers.entries()) {
      for (const [group] of layer.entries()) {
        ensureEntry(group)
      }
    }

    seriesList.forEach((series, index) => {
      const dataSource = series.source === 'layer'
        ? layerMaps.layers.get(series.layer_label || '')
        : layerMaps.primary
      if (!dataSource) return
      for (const [group, row] of dataSource.entries()) {
        const entry = ensureEntry(group)
        entry[series.id] = series.field === 'count' ? row.count : row.value
        if (!entry.colorMap) entry.colorMap = {}
        entry.colorMap[series.id] = series.color || palette[index % palette.length]
      }
    })

    return Array.from(map.values())
  }, [layerMaps, seriesList, palette])

  const pieData = useMemo(() => {
    const rows = data?.rows || []
    return rows.map((r) => ({
      name: r.group === '_total' ? 'Total' : r.group,
      value: r.value,
      count: r.count,
    }))
  }, [data])

  const needsCartesian = ['bar', 'line', 'area', 'scatter'].includes(chartType)
  const needsPie = ['pie', 'funnel'].includes(chartType)
  const hasCartesian = cartesianData.length > 0
  const hasPie = pieData.length > 0

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      {config.title && (
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex-1 min-h-0 pb-4">
        {(needsCartesian && !hasCartesian) || (needsPie && !hasPie) ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' && hasCartesian && (
              <BarChart data={cartesianData}>
                {cc?.show_grid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis dataKey={cc?.x_key || 'name'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                {cc?.show_legend && <Legend />}
                {seriesList.map((series, idx) => (
                  <Bar
                    key={series.id}
                    dataKey={series.id}
                    fill={series.color || palette[idx % palette.length]}
                    radius={[4, 4, 0, 0]}
                    name={series.label}
                    stackId={cc?.stacked ? 'stack' : undefined}
                  />
                ))}
              </BarChart>
            )}
            {chartType === 'line' && hasCartesian && (
              <LineChart data={cartesianData}>
                {cc?.show_grid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis dataKey={cc?.x_key || 'name'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                {cc?.show_legend && <Legend />}
                {seriesList.map((series, idx) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    stroke={series.color || palette[idx % palette.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={series.label}
                  />
                ))}
              </LineChart>
            )}
            {chartType === 'area' && hasCartesian && (
              <AreaChart data={cartesianData}>
                {cc?.show_grid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis dataKey={cc?.x_key || 'name'} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                {cc?.show_legend && <Legend />}
                {seriesList.map((series, idx) => (
                  <Area
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    stroke={series.color || palette[idx % palette.length]}
                    fill={series.color || palette[idx % palette.length]}
                    fillOpacity={0.3}
                    name={series.label}
                  />
                ))}
              </AreaChart>
            )}
            {chartType === 'pie' && hasPie && (
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius="40%" outerRadius="80%" dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                {cc?.show_legend && <Legend />}
              </PieChart>
            )}
            {chartType === 'scatter' && hasCartesian && (
              <ScatterChart>
                {cc?.show_grid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis dataKey="name" tick={{ fontSize: 11 }} name="Group" />
                <YAxis dataKey="value" tick={{ fontSize: 11 }} name="Value" />
                <Tooltip />
                {seriesList.map((series, idx) => (
                  <Scatter
                    key={series.id}
                    data={cartesianData}
                    fill={series.color || palette[idx % palette.length]}
                  />
                ))}
              </ScatterChart>
            )}
            {chartType === 'funnel' && hasPie && (
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={pieData} isAnimationActive>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                  <LabelList position="right" fill="#888" stroke="none" dataKey="name" fontSize={11} />
                </Funnel>
              </FunnelChart>
            )}
            {(chartType !== 'bar' && chartType !== 'line' && chartType !== 'area' && chartType !== 'pie' && chartType !== 'scatter' && chartType !== 'funnel') && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Unknown chart type: {chartType}</p>
              </div>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
