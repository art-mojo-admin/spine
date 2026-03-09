# sql_migrations
How to manage Spine's Supabase/Postgres schema safely using the v2 migration chain.

## 1. Directory Structure
```
supabase/
├── migrations/          # Authoritative chain (001_foundations.sql → latest)
├── migrations_legacy/   # Archived v1 migrations (do NOT re-run)
├── seed-config-packs.sql
├── seed.sql             # Legacy sample data (unused in v2)
└── install*.sql         # Deprecated installers (only kept for historical reference)
```

## 2. Migration Chain
Apply migrations sequentially. As of March 2026 the current chain is `001_foundations.sql` through `028_allow_page_view_type.sql`.

| File | Purpose |
| --- | --- |
| `001_foundations.sql` | Core schemas (accounts, persons, roles, auth helpers) |
| `002_registries.sql` | Registry tables (item types, workflows, action types) |
| `003_workflows.sql` | Workflow definitions + stages |
| `004_items.sql` | Item tables plus triggers |
| `005_threads.sql` | Threaded messaging primitives |
| `006_relationships.sql` | Entity links / relationships |
| `007_automation.sql` | Automation rules, triggers, actions |
| `008_knowledge.sql` | Knowledge base + embeddings |
| `009_views_apps.sql` | View + app definitions (v2 replacements for dashboards) |
| `010_integrations.sql` | Integrations catalog + instances |
| `011_packs.sql` | Pack metadata and seed scaffolding |
| `012_security.sql` | Policies, roles, tenant ownership columns |
| `013_seeds.sql` | Baseline data (roles, registries) |
| `014–024` | Pack-specific seeds (Template, Support, CRM, Sales, Support CSM, Ops, Marketing) |
| `025_hierarchical_accounts.sql` | Parent/child account support |
| `026_tenant_settings.sql` | Account-level settings table |
| `027_remove_kb.sql` | Removes deprecated KB tables |
| `028_allow_page_view_type.sql` | Expands `view_type` constraint to include `page` |

## 3. Applying Migrations
### Option A: Supabase CLI (recommended)
```bash
supabase link --project-ref <project>
supabase db push   # applies new migrations since last push
```
The CLI keeps state in `.supabase/config.toml`. Ensure you commit new migrations before pushing.

### Option B: SQL Editor
1. In Supabase Dashboard → **SQL Editor**.
2. Upload each migration file in order and run.
3. Track which files have been applied manually; there is no out-of-band versioning.

### Option C: `psql`
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/028_allow_page_view_type.sql
```
Useful for targeting a single migration.

## 4. Creating New Migrations
1. Name format: `<sequence>_<short_description>.sql` (keep numbers sequential; no timestamps).
2. Place file under `supabase/migrations/`.
3. Include `BEGIN; ... COMMIT;` blocks for transactional safety when practical.
4. Annotate with comments describing the feature, required env vars, and any backfill steps.
5. Run against a staging project first.

## 5. Seeds & Packs
- Use `supabase/seed-config-packs.sql` to install official packs into a project (installs views/apps, workflows, automations).
- Pack-specific migrations (`014`–`024`) must remain idempotent since they run per-tenant via pack installer.
- If adding a new pack, create a new migration (e.g., `029_seed_pack_success.sql`). Avoid editing previous seeds; add forward-only patches.

## 6. Rollbacks
Spine favors forward-only migrations. If you need to roll back:
1. Create a new migration that reverts the schema change (e.g., drop column, restore constraint).
2. Run it immediately after the failed migration.
3. Avoid editing applied files — Supabase migration history assumes immutability.

## 7. Production Deployment Checklist
| Check | Action |
| --- | --- |
| Migrations applied | `supabase db push` (watch for errors) |
| RLS policies | Verify `security.sql` updates match Netlify function expectations |
| View types | Ensure `028_allow_page_view_type.sql` applied before enabling page builder |
| Seeds | Run relevant pack seeds after structural migrations |
| Netlify env | Add any new env vars introduced by migrations |

## 8. Troubleshooting
| Symptom | Fix |
| --- | --- |
| `ERROR: relation ... already exists` | You may be re-running a migration; skip the file or write a guard (`DROP TABLE IF EXISTS`). |
| `check constraint view_definitions_view_type_check` | Apply migration `028_allow_page_view_type.sql`. |
| Pack install missing views | Confirm pack seed migration executed and `pack-installer` function ran for the tenant. |
| CLI push fails due to drift | Pull the production database schema via `supabase db pull`, rebase your migrations, and re-run push. |

## 9. Related Docs
- [`dev_install.md`](./dev_install.md)
- [`dev_extend.md`](./dev_extend.md)
- [`admin_views.md`](./admin_views.md)
