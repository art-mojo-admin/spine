# App Package Authoring – Follow-up Tasks

This note captures the remaining work to fully enable tenant-authored app packages with the new schema/API primitives introduced in migration 033 and the updated Netlify functions.

## 1. Data Backfill & Integrity Tasks

1. **Populate `config_packs.primary_app_id`**
   - For each existing pack that already owns a single app, set `primary_app_id` to that app's id.
   - For legacy template packs with multiple apps (e.g., Operations), pick the canonical app for now and flag the remainder for manual split.

2. **Stamp `app_id` on pack-owned artifacts**
   - For every table touched in migration 033 (`workflow_definitions`, `view_definitions`, `items`, `threads`, etc.), backfill `app_id` using:
     - `config_packs.primary_app_id` joined via `pack_id` for pack-owned rows.
     - `app_definitions.id` directly where `pack_id` already exists on the row (e.g., `app_definitions`, `view_definitions`).
   - Leave tenant-owned rows (`ownership='tenant'`) with `app_id = NULL`.

3. **Add triggers/constraints (optional follow-up)**
   - Consider NOT NULL constraints on `app_id` for pack-owned rows once backfill proves clean.
   - Add check constraints ensuring `ownership='pack'` implies both `pack_id` and `app_id`.

4. **Write Supabase migration scripts**
   - Migration A: populate `primary_app_id` + `app_id` values.
   - Migration B: enforce constraints (if desired) and add indexes for pack-aware lookups already declared in migration 033.

## 2. API & Service Enhancements

1. **Pack-scoped creation helpers**
   - Update view/workflow/automation creation endpoints to require (or infer) `app_id` when `pack_id` is provided.
   - Ensure cloning utilities (`cloneTemplatesForPack`) copy `app_id` references so exports remain consistent.

2. **Export payload**
   - Confirm `/config-packs?action=export` includes the new `app_id` fields (should come for free after backfill, but add regression test).
   - Document that tenant-authored packs export exactly one app plus related configs.

3. **Access control**
   - Introduce a reusable helper for "owned pack" checks so future APIs (views, workflows, content) can gate edits to a tenant's pack.

## 3. Admin UI Workstream

1. **Pack creation UX**
   - Add "New Pack" CTA on `/admin/packs` wired to `action=create_pack`.
   - Show ownership (system vs tenant) and disable install/uninstall buttons for tenant-owned packs (these are authoring surfaces, not templates).

2. **App creation wizard**
   - Update `/admin/apps` create modal to:
     1. Force selection of an existing tenant-owned pack without an app, **or**
     2. Create a new pack inline before creating the app.
   - Persist selected pack id when hitting the builder.

3. **Global pack context**
   - Add an "Active Pack" selector stored in context/local storage.
   - All admin CRUD pages should scope queries/mutations by this pack id and pass it to APIs.

4. **App builder surface**
   - Within `/admin/apps/:id/builder`, show tabs for pack assets (views, workflows, automations, sample data) filtered by `app_id`.
   - Provide quick-create actions that prefill `pack_id`/`app_id`.

5. **Export affordance**
   - Add "Export App Package" button on the app builder that opens the existing export URL for the backing pack.

## 4. Testing & Tooling

- Add integration tests covering new pack creation → app creation → asset authoring → export.
- Seed data adjustments: ensure each template pack advertises which app is primary (for eventual splitting).
- Update documentation (README/admin guide) to describe the new workflow for building custom packs.
