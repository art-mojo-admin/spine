export interface WidgetTypeDefinition {
  type: string
  label: string
  category: 'layout' | 'content' | 'data' | 'chart' | 'navigation' | 'embed'
  icon: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  hasDataSource: boolean
}

export const WIDGET_TYPES: WidgetTypeDefinition[] = [
  // Layout
  { type: 'spacer', label: 'Spacer', category: 'layout', icon: 'minus', defaultSize: { w: 12, h: 1 }, hasDataSource: false },
  { type: 'divider', label: 'Divider', category: 'layout', icon: 'minus', defaultSize: { w: 12, h: 1 }, hasDataSource: false },
  { type: 'tabs', label: 'Tabs', category: 'layout', icon: 'layout-grid', defaultSize: { w: 12, h: 6 }, hasDataSource: false },
  { type: 'accordion', label: 'Accordion', category: 'layout', icon: 'chevrons-down', defaultSize: { w: 12, h: 4 }, hasDataSource: false },

  // Content
  { type: 'content', label: 'Rich Text', category: 'content', icon: 'file-text', defaultSize: { w: 6, h: 3 }, hasDataSource: false },
  { type: 'heading', label: 'Heading', category: 'content', icon: 'type', defaultSize: { w: 12, h: 1 }, hasDataSource: false },
  { type: 'image', label: 'Image', category: 'content', icon: 'image', defaultSize: { w: 4, h: 3 }, hasDataSource: false },

  // Data
  { type: 'stat', label: 'Stat Card', category: 'data', icon: 'hash', defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, hasDataSource: true },
  { type: 'count', label: 'Count', category: 'data', icon: 'hash', defaultSize: { w: 2, h: 2 }, minSize: { w: 2, h: 2 }, hasDataSource: true },
  { type: 'table', label: 'Data Table', category: 'data', icon: 'table', defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 }, hasDataSource: true },
  { type: 'item_list', label: 'Item List', category: 'data', icon: 'list', defaultSize: { w: 4, h: 4 }, minSize: { w: 3, h: 3 }, hasDataSource: true },

  // Chart
  { type: 'chart', label: 'Chart', category: 'chart', icon: 'bar-chart-3', defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, hasDataSource: true },

  // Navigation
  { type: 'nav_tree', label: 'Nav Tree', category: 'navigation', icon: 'navigation', defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 2 }, hasDataSource: false },
  { type: 'link_list', label: 'Link List', category: 'navigation', icon: 'link', defaultSize: { w: 3, h: 3 }, hasDataSource: false },

  // Embed
  { type: 'view_embed', label: 'Embed View', category: 'embed', icon: 'layout-grid', defaultSize: { w: 6, h: 4 }, minSize: { w: 3, h: 3 }, hasDataSource: false },
]

export const WIDGET_TYPE_MAP = new Map(WIDGET_TYPES.map(w => [w.type, w]))

export const WIDGET_CATEGORIES = [
  { key: 'layout', label: 'Layout' },
  { key: 'content', label: 'Content' },
  { key: 'data', label: 'Data' },
  { key: 'chart', label: 'Charts' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'embed', label: 'Embed' },
] as const

export interface WidgetConfig {
  id: string
  widget_type: string
  title: string
  position: { x: number; y: number; w: number; h: number }
  position_md?: { x: number; y: number; w: number; h: number }
  position_sm?: { x: number; y: number; w: number; h: number }
  data_source?: DataSourceConfig
  chart_config?: ChartConfig
  stat_config?: StatConfig
  content_config?: ContentConfig
  nav_config?: NavConfig
  embed_config?: EmbedConfig
  tabs_config?: TabsConfig
  accordion_config?: AccordionConfig
  style?: StyleConfig
  visibility?: { min_role?: string }
}

export interface DataSourceConfig {
  entity: string
  filters?: Record<string, any>
  group_by?: string
  aggregate?: string
  time_range?: string
  sort?: string
  limit?: number
  layers?: { label: string; time_range?: string; time_offset?: string }[]
}

export interface ChartSeriesConfig {
  id: string
  label: string
  source: 'primary' | 'layer'
  field: 'value' | 'count'
  layer_label?: string
  color?: string
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'area' | 'pie' | 'funnel' | 'scatter'
  x_key?: 'name' | 'value' | 'count'
  colors?: string[]
  stacked?: boolean
  show_legend?: boolean
  show_grid?: boolean
  series?: ChartSeriesConfig[]
}

export interface StatConfig {
  icon?: string
  suffix?: string
  trend_compare?: string
}

export interface ContentConfig {
  format: 'markdown' | 'html'
  body: string
}

export interface NavConfig {
  items: NavConfigItem[]
}

export interface NavConfigItem {
  label: string
  icon?: string
  view_slug?: string
  url?: string
  filter?: string
  min_role?: string
  children?: NavConfigItem[]
}

export interface EmbedConfig {
  view_slug: string
}

export interface TabsConfig {
  tabs: { label: string; widgets: WidgetConfig[] }[]
}

export interface AccordionConfig {
  items: { label: string; widgets: WidgetConfig[] }[]
}

export interface StyleConfig {
  bg_color?: string
  padding?: string
  border_radius?: string
  border?: boolean
}

export interface PageConfig {
  layout: {
    breakpoints: { lg: number; md: number; sm: number }
    cols: { lg: number; md: number; sm: number }
    rowHeight: number
  }
  widgets: WidgetConfig[]
}

export const DEFAULT_PAGE_CONFIG: PageConfig = {
  layout: {
    breakpoints: { lg: 1200, md: 996, sm: 768 },
    cols: { lg: 12, md: 8, sm: 4 },
    rowHeight: 60,
  },
  widgets: [],
}

export const DEFAULT_CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
]
