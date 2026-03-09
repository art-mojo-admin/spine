# admin_views
How to model views, build pages, and ship tenant-facing apps with Spine's view system.

## 1. Concepts
| Term | Description |
| --- | --- |
| **View Definition** | Row in `view_definitions` that defines slug, name, `view_type`, layout config, and RBAC guard. Managed in `/admin/views` and via the `view-definitions` Netlify function. |
| **Page Builder** | Visual editor at `/builder/:viewId` for `view_type = "page"`. Uses responsive grid layout + widget inspector. |
| **Widget** | Reusable renderers declared in `src/lib/widgetRegistry.ts`. Each widget has defaults, inspector UI, and runtime renderer. |
| **App Definition** | Collections of views + nav metadata rendered in the sidebar. Allows bundling multiple views under one app. |

## 2. Creating a View Definition
1. Visit **Admin → Views**.
2. Click **New View**. Choose a unique slug (used in URLs `/views/<slug>`).
3. Select a **View Type**:
   - `list`, `board`, `detail`, `dashboard`, `portal_page`, or `page`.
4. Configure metadata:
   - **Minimum Role**: enforce tenant RBAC.
   - **Nav Section**: where it appears in sidebar (if part of app).
5. Save — this issues a POST to `/netlify/functions/view-definitions`.

> If you encounter `view_type` constraint errors, confirm migration `028_allow_page_view_type.sql` is applied.

## 3. Building Page Views
Page views unlock the React drag-and-drop builder.

1. After saving with `view_type = "page"`, click **Edit Page** to open `/builder/:viewId`.
2. Canvas controls:
   - **Add Widget** dropdown pulls definitions from `widgetRegistry.ts`.
   - **Grid** based on `react-grid-layout/legacy`, supporting desktop/tablet/mobile breakpoints.
   - **Widget Inspector** toggles when an item is selected; allows editing props, nested scopes (tabs/accordion), and design tokens.
3. Use the **History** buttons (undo/redo) to iterate safely.
4. Publish changes with **Save** — config stored on the view definition.
5. Preview via `/views/<slug>`.

## 4. Widgets Available by Default
| Widget | Use Case |
| --- | --- |
| `HeroWidget` | Large hero block with actions, pulling text + CTA from inspector. |
| `RichTextWidget` | Portable text/markdown block using tiptap JSON. |
| `ChartWidget` | Declarative charts fed by Netlify functions (see `src/components/page-renderer/widgets/ChartWidget.tsx`). |
| `ListWidget` | Lists workflow items filtered by scope. |
| `TabsWidget` / `AccordionWidget` | Container widgets supporting nested children. |
| `EmbedWidget` | Iframes for dashboards or external tools. |

Admins can request new widgets from developers; see `code_widgets.md` for implementation steps.

## 5. Linking Views into Apps
1. Navigate to **Admin → Apps**.
2. Create or edit an app definition, selecting which views belong in the left nav.
3. Each nav item supports:
   - **Label** and **Icon** (Lucide name).
   - **Min Role** per nav entry.
   - Optional **pack dependency** so packs can ship apps pre-linked.
4. The sidebar is computed through the `compute-nav` function. Ensure new apps are deployed before expecting nav changes.

## 6. Publishing Workflow
| Stage | Owner | Notes |
| --- | --- | --- |
| Draft page layout | Builder | Use staging tenant to avoid breaking prod. |
| QA | Admin + Developer | Verify `/views/<slug>` renders for target roles/accounts. |
| Promote | Admin | Share slug or add to app nav for visibility. |
| Monitor | Admin | Watch Netlify logs + Supabase metrics for new widgets hitting APIs. |

## 7. Troubleshooting
| Issue | Fix |
| --- | --- |
| Builder fails to load config | Check browser console for invalid widget config; revert via `/netlify/functions/view-definitions/:id` PATCH with last-known-good config. |
| Widgets overlap unexpectedly | Ensure each widget has unique `i` in layout; the builder handles this automatically, but manual JSON edits can break it. |
| View missing from sidebar | Confirm app definition includes the view and user has sufficient role. Re-run `compute-nav` (Netlify function) if caching via pack install. |
| Page renders blank | Ensure `PageRenderer` has case for widget type; custom widgets require updates in `src/pages/ViewRenderer.tsx`. |

## 8. Related Docs
- [`dev_install.md`](./dev_install.md) for local setup.
- [`dev_extend.md`](./dev_extend.md) for adding widgets or APIs.
- [`sql_migrations.md`](./sql_migrations.md) for schema/application steps.
