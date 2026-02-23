# Spine — New Project Setup Guide

This guide walks you through creating a new project from the Spine template.

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** (or yarn)
- A **Supabase** project ([supabase.com](https://supabase.com))
- A **Netlify** account ([netlify.com](https://netlify.com))
- **Git** installed locally

---

## 1. Clone the Template

```bash
# Option A: Use GitHub's "Use this template" button (recommended)
# Option B: Clone manually
git clone https://github.com/YOUR_ORG/spine-template.git my-new-project
cd my-new-project
rm -rf .git
git init
git add .
git commit -m "Initial commit from Spine template"
```

---

## 2. Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Pick a name, password, and region
3. Wait for the project to finish provisioning

---

## 3. Run the Database Installer

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `supabase/install.sql` from this repo
3. Paste the entire contents into the SQL editor and click **Run**

This creates all tables, indexes, triggers, RLS policies, security lockdown, and template packs.

> **Note:** The `vector` extension requires the Supabase project to have `pgvector` enabled.  
> Go to **Database → Extensions** and enable `vector` if it isn't already.

---

## 4. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project credentials:

| Variable | Where to find it |
|---|---|
| `VITE_APP_NAME` | Your app's display name (e.g. "Acme CRM") |
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` key |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key (⚠️ keep secret) |

Optional variables (see `.env.example` for all):

| Variable | Purpose |
|---|---|
| `SITE_URL` | Custom domain for CORS headers |
| `OPENAI_API_KEY` | AI-powered workflow actions |
| `EMAIL_PROVIDER` | `resend`, `sendgrid`, or `webhook` |
| `EMAIL_API_KEY` | API key for your email provider |
| `EMAIL_FROM` | Sender address for outbound email |

---

## 5. Install Dependencies

```bash
npm install
```

---

## 6. Run Locally

```bash
# Start the Vite dev server + Netlify Functions
npx netlify dev
```

The app will be available at `http://localhost:8888`.

---

## 7. Create Your First User

1. Go to your Supabase dashboard → **Authentication** → **Users**
2. Click **Add User** → **Create New User**
3. Enter an email and password
4. Open the app at `http://localhost:8888` and sign in
5. On first login, the app will create a person record and prompt account setup

---

## 8. Harden Auth Settings (Supabase Dashboard)

In **Authentication → Settings**:

- ✅ Enable **Leaked password protection**
- ✅ Set **Minimum password length** to at least 8
- ✅ Enable **Email confirmations** for production
- Consider disabling **Anonymous sign-ins** unless needed

---

## 9. Deploy to Netlify

### Option A: Netlify CLI

```bash
npm install -g netlify-cli
netlify init          # Link to a new Netlify site
netlify deploy --prod
```

### Option B: Git-based Deploy

1. Push your repo to GitHub
2. In Netlify → **Add new site** → **Import an existing project**
3. Select your repo; Netlify auto-detects the build settings from `netlify.toml`

### Set Environment Variables in Netlify

Go to **Site settings → Environment variables** and add the same variables from your `.env` file. At minimum:

- `VITE_APP_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 10. Customise Your Project

### Branding

Change `VITE_APP_NAME` in your `.env` file. This updates:

- Page title (`<title>` tag)
- Login screen heading
- Sidebar brand text
- Portal shell brand text
- KB article global badges
- localStorage key prefixes
- Outbound webhook header prefixes

### Template Packs

The database comes pre-loaded with 12 template packs (CRM, Support, Recruiting, etc.). Users can install these from **Admin → Template Packs** in the app.

### Theming

Each tenant/account can configure its own theme via **Admin → Theme**. The theming system supports presets (clean, bold, muted) and custom tokens.

---

## Project Structure

```
├── index.html              # Vite entry point
├── netlify.toml            # Netlify build & function config
├── package.json
├── .env.example            # All environment variables
├── src/
│   ├── lib/
│   │   ├── config.ts       # Centralised branding config
│   │   ├── auth.ts         # Supabase client
│   │   ├── api.ts          # API helper (calls Netlify functions)
│   │   └── ...
│   ├── components/
│   ├── pages/
│   └── hooks/
├── netlify/
│   └── functions/          # Serverless API (Netlify Functions)
│       ├── _shared/        # Shared utilities (db, middleware, security)
│       └── *.ts            # Individual API endpoints
└── supabase/
    ├── install.sql         # Master DB installer (run once)
    ├── migrations/         # Individual migration files (reference)
    └── seed-config-packs.sql
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `relation "accounts" does not exist` | Run `supabase/install.sql` in the SQL editor |
| CORS errors in browser | Set `SITE_URL` env var to your domain |
| Functions return 500 | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Netlify env vars |
| AI actions do nothing | Set `OPENAI_API_KEY` env var |
| `%VITE_APP_NAME%` shows in title | Ensure `VITE_APP_NAME` is set in `.env` before building |
