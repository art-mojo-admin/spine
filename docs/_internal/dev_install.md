# dev_install
This guide explains how to get Spine running locally with Supabase Postgres, Netlify Functions, and the React builder so contributors can test changes end-to-end.

## 1. Prerequisites
- **Node.js 18+** (ensure `node -v` ≥ 18.18)
- **Yarn 1.22** (repo uses classic yarn for scripts)
- **Netlify CLI** (`npm i -g netlify-cli`) for local function emulation
- **Supabase project** with pgvector enabled (project ID `uyokuiibztwfasdprsov` in production; use your own sandbox for local testing)
- **Supabase CLI** (optional but recommended) if you want to run migrations via `supabase db push`

## 2. Clone & Install
```bash
git clone https://github.com/art-mojo-admin/spine.git
cd spine-ia
corepack enable
yarn install
```
Yarn automatically installs frontend, Netlify, and Supabase dependencies.

## 3. Environment Variables
1. Copy `.env.example` → `.env`.
2. Fill in the following (values from your Supabase project + Netlify site):
   ```dotenv
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   NETLIFY_SITE_ID=<optional for CLI deploys>
   NETLIFY_AUTH_TOKEN=<optional>
   ```
3. Keep the service role key private—only Netlify Functions should use it.

## 4. Database Bootstrap
Spine tracks migrations in `supabase/migrations/`. Apply them sequentially:
```bash
# Run inside the repo root
supabase db remote commit --project-ref <project-ref>
# or apply via SQL editor by uploading scripts 001_* through 028_allow_page_view_type.sql
```
Tips:
- The clean v2 chain is 001–028. Do **not** mix with `supabase/migrations_legacy/`.
- Migration 028 allows the `page` view type; ensure it is applied before using the builder.
- If you need local Postgres, `supabase start` spins up dockerized services, but most devs point directly at a hosted project.

## 5. Local Development Workflow
```bash
# Assemble Netlify functions (core + custom overlay)
yarn assemble
# Optional integrity check (warns on drift from manifest)
yarn verify
# Start unified dev server (Vite + Netlify Functions proxy)
netlify dev
```
`netlify dev` launches:
- Vite on 5173 (proxied)
- Netlify Functions on 8888
- Browser entrypoint at `http://localhost:8888`

Use any Supabase user credentials; the first login for an email automatically provisions account/person/membership via `/core/functions/auth.ts`.

## 6. Building & Testing
- **Type-check & bundle**: `yarn build` (runs `tsc -b && vite build` via package.json)
- **Lint**: `yarn lint`
- **Manual QA**: ensure you can create a view via `/admin/views`, open Page Builder, and render it via `/views/:slug`.

## 7. Troubleshooting
| Symptom | Fix |
| --- | --- |
| `react-grid-layout` type errors | Ensure imports use `react-grid-layout/legacy` (see `code_widgets.md`). |
| Integrity script fails before build | Run `yarn assemble` then `yarn verify`; if working on core runtime, update `.spine-manifest.json`. |
| Supabase RLS errors | Confirm Netlify Functions use the service-role key via `.env`. Never call Supabase directly from the browser. |
| Builder POST `/view-definitions` 500 | Verify migration 028 applied so `view_type='page'` passes the check constraint. |

## 8. Next Steps
- Review [`dev_extend.md`](./dev_extend.md) to customize functions or widgets.
- See [`sql_migrations.md`](./sql_migrations.md) for deeper migration workflows.
