# code_widgets
Deep dive into Spine's widget system powering the page builder and runtime renderer.

## 1. Anatomy of a Widget
Widgets have three touchpoints:
1. **Registry entry** in `src/lib/widgetRegistry.ts` defining metadata, default sizes, and config shape.
2. **Inspector UI** (usually in `WidgetInspector.tsx`) that lets builders edit widget properties.
3. **Runtime renderer** in `src/components/page-renderer/widgets/<WidgetName>Widget.tsx` consumed by `PageRenderer`.

```
src/
├── components/canvas-builder/WidgetInspector.tsx   # editing experience
├── components/page-renderer/WidgetGrid.tsx         # responsive grid wrapper
├── components/page-renderer/widgets/               # runtime components
└── lib/widgetRegistry.ts                           # schema + defaults
```

## 2. Registry
Each entry in `WIDGET_TYPES` controls how the builder surfaces the widget.

```ts
{ type: 'chart', label: 'Chart', category: 'chart', icon: 'bar-chart-3', defaultSize: { w: 6, h: 4 }, hasDataSource: true }
```

`WidgetConfig` defines runtime state: ids, layout per breakpoint, configs (data_source, chart_config, etc.).

Key fields:
- `position`, `position_md`, `position_sm`: grid coordinates synced by `react-grid-layout/legacy`.
- `data_source`: informs `useWidgetData` which Netlify function + filters to call.
- `tabs_config` / `accordion_config`: nested child widgets managed via builder scopes.
- `style`: Tailwind-friendly tokens (bg color, padding, border radius, etc.).

## 3. Builder Experience
`WidgetInspector` conditionally renders editors based on `widget.widget_type`.
- `DataSourceEditor` wires entity, filters, aggregates.
- `ChartConfigEditor` exposes series, colors, axes.
- `TabsStructureEditor` and `AccordionStructureEditor` manage nested stacks using `BuilderScope` helpers from `src/lib/pageBuilderUtils.ts`.
- `StyleEditor` normalizes tokens so runtime can keep tailwind classes minimal.

When adding a new widget, extend `WidgetInspector` with any custom editors required to mutate `WidgetConfig` safely. Prefer controlled inputs and stateless helper components.

## 4. Runtime Rendering
`src/components/page-renderer/widgets` contains individual components. Each receives the widget's section of config plus shared helpers.

Example: `ChartWidget.tsx`
- Pulls data via `useWidgetData(data_source)` (wraps fetch + caching + loading states).
- Uses Recharts primitives to render `bar`, `line`, `area`, `pie`, `scatter`, and `funnel` charts.
- Handles missing data gracefully (shows “No data” or error states).

Other widgets follow similar patterns: `RichTextWidget` renders markdown, `ListWidget` queries workflow items, `EmbedWidget` displays other views.

## 5. Adding a New Widget
1. **Registry**: add entry to `WIDGET_TYPES` with type name, icon, default sizes.
2. **Inspector**:
   - Extend `WidgetInspector` to include editors for new config fields.
   - Add helpers (e.g., `LinkListEditor`) if the config is complex.
3. **Renderer**:
   - Create `src/components/page-renderer/widgets/<Name>Widget.tsx`.
   - Export and register inside `src/pages/ViewRenderer.tsx` switch statement.
4. **Builder wiring**:
   - `WidgetPanel` (if exists) should categorize the widget.
   - Provide defaults via `widgetRegistry.ts` to avoid undefined config during drag.
5. **Data**:
   - If widget hits APIs, add a Netlify function under `core/functions/` or `custom/functions/` and use `apiGet`/`apiPost` wrappers.

## 6. Testing Widgets
- Use the builder to add the widget and inspect JSON via `/admin/views` → export.
- Render via `/views/<slug>` and check responsive breakpoints.
- Confirm `useWidgetData` handles loading/error states.
- For charts, add regression fixtures in `useWidgetData` mock data if needed.

## 7. Tips & Patterns
- Keep widget components pure; fetch inside hooks like `useWidgetData`.
- Memoize heavy computations (see `ChartWidget`’s `useMemo` maps).
- Avoid direct Supabase calls from widgets. Always go through Netlify functions for RBAC and auditing.
- When nesting widgets (tabs/accordion), rely on `BuilderScope` utilities to ensure IDs remain unique.
- Document new widget config in this file and `WidgetInspector` comments to aid future contributors.

## 8. Related Docs
- [`dev_extend.md`](./dev_extend.md) — how to extend runtime safely.
- [`admin_views.md`](./admin_views.md) — how admins use widgets inside views.
- [`sql_migrations.md`](./sql_migrations.md) — schema changes that might power new widgets.
