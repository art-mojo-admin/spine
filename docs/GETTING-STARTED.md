# Spine — Getting Started

A single-page guide to go from zero to running Spine locally and deploying to production.

---

## Prerequisites

- **Node.js** ≥ 18 and **npm**
- A **Supabase** project ([supabase.com](https://supabase.com))
- A **Netlify** account ([netlify.com](https://netlify.com))
- **Netlify CLI**: `npm i -g netlify-cli`

---

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/spine.git my-project
cd my-project
npm install
```

---

## 2. Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Pick a name, password, and region
3. Wait for provisioning to complete
4. Enable the `vector` extension: **Database → Extensions → search "vector" → Enable**

---

## 3. Apply the Database

Run the migration chain (`supabase/migrations/001_foundations.sql` → latest). Two common ways:

**Supabase CLI (recommended)**
```bash
supabase link --project-ref <project>
supabase db push
```

**SQL Editor**
1. Upload each file in `supabase/migrations/` sequentially.
2. Finish by applying `028_allow_page_view_type.sql` to unlock the page builder.

See [`sql_migrations.md`](sql_migrations.md) for deeper guidance plus pack seed instructions.

---

## 4. Set Environment Variables

```bash
cp .env.example .env
```

Fill in the four required values:

| Variable | Where to Find |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon public** key |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** key |

Optional but recommended:

| Variable | Purpose |
|---|---|
| `VITE_APP_NAME` | Your app's display name (default: "Spine") |
| `OPENAI_API_KEY` | Enables AI actions and real embeddings |

See [ENVIRONMENT.md](ENVIRONMENT.md) for the full reference.

---

## 5. Run Locally

```bash
npx netlify dev
```

This starts:
- Vite dev server on port **5173**
- Netlify Functions proxy on port **8888**
- App at **http://localhost:8888**

---

## 6. Create Your First User

1. In Supabase dashboard → **Authentication → Users → Add User → Create New User**
2. Enter an email and password
3. Open **http://localhost:8888** and sign in
4. On first login, Spine auto-provisions:
   - A `persons` record linked to the Supabase Auth user
   - A `profiles` record
   - A new `accounts` record (organization)
   - A `memberships` record with role **admin**

You're now logged in as an admin of your first account.

---

## 7. Install a Template Pack (Optional)

1. Go to **Admin → Templates** in the sidebar
2. Browse available packs (CRM, Support, Sales, etc.)
3. Click **Install** on any pack

This seeds your account with workflow definitions, stages, automations, views, and sample data.

---

## 8. Harden Auth Settings

In Supabase → **Authentication → Settings**:

- ✅ Enable **Leaked password protection**
- ✅ Set **Minimum password length** to at least 8
- ✅ Enable **Email confirmations** for production
- Consider disabling **Anonymous sign-ins** unless needed

---

## 9. Deploy to Netlify

### Option A: CLI

```bash
netlify init          # Link to a new Netlify site
netlify deploy --prod
```

### Option B: Git-based

1. Push your repo to GitHub
2. In Netlify → **Add new site → Import an existing project**
3. Select your repo — Netlify auto-detects build settings from `netlify.toml`

### Set Environment Variables in Netlify

Go to **Site settings → Environment variables** and add at minimum:

- `VITE_APP_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 10. Verify

After deployment, confirm:

| Check | How |
|---|---|
| Login works | Sign in at your Netlify URL |
| API responds | Visit `/api/me` in browser (should return JSON) |
| Sidebar loads | Nav items appear after login |
| Admin section | Visible if you're logged in as admin |

---

## What's Next

| Goal | Documentation |
|---|---|
| Understand the architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Learn the data model | [DATA-MODEL.md](DATA-MODEL.md) |
| Build custom features | [EXTENDING.md](EXTENDING.md) |
| Configure workflows | [WORKFLOW-ENGINE.md](WORKFLOW-ENGINE.md) |
| Set up automations | [AUTOMATION.md](AUTOMATION.md) |
| Create apps and views | [APPS-AND-VIEWS.md](APPS-AND-VIEWS.md) |
| Connect external systems | [INTEGRATIONS.md](INTEGRATIONS.md) |
| Understand the object model | [OBJECT-MODEL.md](OBJECT-MODEL.md) |
| Full API reference | [API.md](API.md) |
| Environment variables | [ENVIRONMENT.md](ENVIRONMENT.md) |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `relation "accounts" does not exist` | Ensure migrations 001–013 ran (especially `001_foundations.sql`) |
| CORS errors in browser | Set `SITE_URL` env var to your domain |
| Functions return 500 | Check `SUPABASE_SERVICE_ROLE_KEY` is set |
| AI actions do nothing | Set `OPENAI_API_KEY` env var |
| `%VITE_APP_NAME%` in title | Ensure `VITE_APP_NAME` is set before building |
| Login works but no data loads | Confirm `X-Account-Id` header — check browser network tab |
| First login shows blank | Auto-provisioning may have failed — check function logs in Netlify |
