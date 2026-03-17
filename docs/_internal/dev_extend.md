# dev_extend
Guidance for extending Spine's runtime safely without forking core code. Use this when adding custom widgets, Netlify functions, or admin flows for specific tenants.

## 1. Repo Layout Basics
| Path | Purpose |
| --- | --- |
| `core/functions/` | Canonical Spine API. Treat as read-only unless contributing upstream. |
| `core/src/` | Canonical Spine frontend. Treat as read-only unless contributing upstream. |
| `custom/functions/` | Your overrides. Any file here mirrors `core/functions/<name>.ts` if you need to patch behavior. |
| `custom/src/` | Frontend overrides. Register routes/nav via `custom/src/manifest/routes.ts`. |
| `scripts/assemble-functions.sh` | Merges `core` + `custom` into `netlify/functions/` before builds. |
| `scripts/assemble-frontend.sh` | Merges `core/src` + `custom/src` into `src/` before builds. |
| `.spine-manifest.json` | Hashes of core runtime. `npm run verify` ensures you didn't accidentally modify core. |

## 2. Extending Netlify Functions
1. Add a file under `custom/functions/<endpoint>.ts`.
2. Export `handler` the same way core files do.
3. Run `npm run assemble` — your custom file overlays the core version with the same name.
4. Use helpers from `core/functions/_shared/` by importing with `@core/functions/_shared/db` path aliases.
5. Always log context + account/person IDs for audit parity.

### Example: custom view-definition validation
```ts
// custom/functions/view-definitions.ts
import baseHandler from "@core/functions/view-definitions";

export const handler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  if (body.view_type === "page" && !body.config?.pageTheme) {
    return { statusCode: 400, body: JSON.stringify({ error: "pageTheme required" }) };
  }
  return baseHandler(event);
};
```

## 3. Extending the Frontend
1. Create React components inside `custom/src/`.
2. Register routes + navigation entries in `custom/src/manifest/routes.ts`:
   ```ts
   import type { CustomRoute } from "@/src/custom/types";

   export const customRoutes: CustomRoute[] = [
     {
       path: "/custom/ops",
       element: () => import("./pages/OpsDashboard"),
       navItem: {
         label: "Ops Dashboard",
         section: "custom",
         minRole: "admin",
       },
     },
   ];
   ```
3. `scripts/assemble-frontend.sh` merges `core/src` + `custom/src` into `src/`. Use `import { CustomView } from "@custom/components"` patterns to avoid relative-chains.
4. Keep styling aligned with Tailwind + shadcn tokens (`@core/lib/theme.ts`).

## 4. Adding Widgets
1. Define the renderer at `core/src/components/page-renderer/widgets/<Name>Widget.tsx`.
2. Define inspector/editor UI in `core/src/components/canvas-builder/WidgetInspector.tsx` (or split files if sizeable).
3. Register widget metadata in `core/src/lib/widgetRegistry.ts`:
   ```ts
   export const WIDGETS: WidgetDefinition[] = [
     {
       type: "chart",
       label: "Chart",
       inspector: ChartWidgetInspector,
       defaults: {
         layout: { w: 6, h: 6 },
         config: { chartType: "bar" },
       },
     },
   ];
   ```
4. For dynamic data, hit your Netlify function via `apiGet"/charts"` using helpers in `@core/lib/api.ts`.
5. Ensure `PageRenderer` has a case for the widget; keep runtime component props type-safe.

## 5. Database Changes & Migrations
- Put SQL in `supabase/migrations/<timestamp>_<description>.sql`.
- Test via Supabase CLI or dashboard before committing.
- Update documentation (`sql_migrations.md`) with notable requirements (new env vars, background jobs, etc.).
- Rerun `npm run assemble && npm run verify` after schema changes to ensure API/builds still pass.

## 6. Testing & QA
| Check | Command |
| --- | --- |
| Type safety | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Dev server | `npm run dev` |
| Unit/integration (manual) | Use Storybook-like sandboxes in `custom/src/pages` |

## 7. Deployment Tips
- Netlify picks up `netlify/functions` output; ensure `npm run assemble` runs in CI (package.json prebuild already calls it).
- For multi-tenant customizations, guard logic by `account_id` or `pack_id` instead of branching by email.
- Keep secrets in Netlify env vars; reference via `process.env`. Never commit secrets into docs or code.
