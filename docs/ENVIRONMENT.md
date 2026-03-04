# Spine — Environment Variables Reference

Complete reference for all environment variables used by Spine.

---

## Required Variables

These must be set for Spine to function.

| Variable | Example | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://abc123.supabase.co` | Supabase project URL (frontend) |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase anon/public key (frontend) |
| `SUPABASE_URL` | `https://abc123.supabase.co` | Supabase project URL (backend — same as VITE_SUPABASE_URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Supabase service role key (backend — **keep secret**) |

### Where to Find

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings → API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Branding

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_NAME` | `Spine` | App name shown throughout the UI |

This single variable controls:

| Derived Value | Used In |
|---|---|
| Page `<title>` | Browser tab |
| Login screen heading | Login page |
| Sidebar brand text | Shell sidebar |
| Portal brand text | Portal shell |
| `localStorage` key prefix | `{app-name}.activeAccountId`, etc. |
| Webhook signature header | `X-{App-Name}-Signature` |

Set in `src/lib/config.ts`:
```typescript
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Spine'
export const STORAGE_PREFIX = APP_NAME.toLowerCase().replace(/\s+/g, '-')
export const WEBHOOK_HEADER_PREFIX = `X-${APP_NAME.replace(/\s+/g, '-')}`
```

---

## CORS / Security

| Variable | Default | Description |
|---|---|---|
| `SITE_URL` | Auto-detected by Netlify | Your production site URL for CORS `Access-Control-Allow-Origin` header |
| `URL` | Auto-set by Netlify | Netlify site URL (fallback if `SITE_URL` not set) |

The middleware uses: `SITE_URL || URL || '*'`

Set `SITE_URL` if:
- You use a custom domain (e.g., `https://app.yourcompany.com`)
- You want to restrict CORS to a specific origin

---

## AI (Optional)

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(none)* | OpenAI API key for embeddings and AI prompt actions |

### What It Enables

| Feature | Without Key | With Key |
|---|---|---|
| Embeddings | Stub vectors (deterministic but meaningless) | Real `text-embedding-3-small` vectors |
| Semantic search | Works but results are random | Accurate similarity ranking |
| AI prompt action | Fails with error | Calls OpenAI chat completions |
| AI invoke endpoint | Fails with error | Returns AI response |

### Getting a Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to **API Keys**
3. Create a new key
4. Set as `OPENAI_API_KEY` in your environment

---

## Email (Optional)

| Variable | Default | Description |
|---|---|---|
| `EMAIL_PROVIDER` | `webhook` | Email provider: `resend`, `sendgrid`, or `webhook` |
| `EMAIL_API_KEY` | *(none)* | API key for the selected provider |
| `EMAIL_FROM` | `noreply@example.com` | Sender address for outbound email |
| `EMAIL_WEBHOOK_URL` | *(none)* | Webhook URL for the `webhook` provider (e.g., Make.com scenario) |

### Provider Details

#### Resend
```
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_abc123...
EMAIL_FROM=noreply@yourdomain.com
```

#### SendGrid
```
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=SG.abc123...
EMAIL_FROM=noreply@yourdomain.com
```

#### Webhook (default)
Sends email data as JSON to an external webhook (e.g., Make.com, Zapier):
```
EMAIL_PROVIDER=webhook
EMAIL_WEBHOOK_URL=https://hook.us1.make.com/your-scenario-id
```

Payload sent to webhook:
```json
{
  "to": "recipient@example.com",
  "subject": "Subject line",
  "body_html": "<p>HTML content</p>",
  "body_text": "Plain text content",
  "action_name": "Send Welcome Email",
  "payload": { /* trigger context */ }
}
```

---

## Database Schema (Advanced)

| Variable | Default | Description |
|---|---|---|
| `VITE_DB_SCHEMA` | *(none)* | Frontend schema override (deprecated) |
| `DB_SCHEMA` | *(none)* | Backend schema override (deprecated) |

**Do not set these** unless you are using the deprecated namespaced installer (`supabase/install-namespaced.sql`). Modern Spine runs entirely in the `public` schema.

---

## Integrity

| Variable | Default | Description |
|---|---|---|
| `SPINE_INTEGRITY` | `warn` | Integrity check mode: `warn` or `enforce` |

| Mode | Behavior |
|---|---|
| `warn` | Log warnings for modified core files, continue build |
| `enforce` | Fail the build if any core file has been modified |

Set to `enforce` in CI/CD pipelines to prevent unauthorized core modifications.

---

## Netlify Auto-Set Variables

These are automatically set by Netlify and used by the runtime:

| Variable | Description |
|---|---|
| `URL` | The Netlify site URL (e.g., `https://my-site.netlify.app`) |
| `SITE_ID` | Netlify site identifier |
| `DEPLOY_URL` | URL of the specific deploy |

---

## Setting Variables

### Local Development

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

The `.env` file is gitignored and loaded automatically by Vite and Netlify CLI.

### Netlify (Production)

Go to **Site settings → Environment variables** in the Netlify dashboard, or use the CLI:

```bash
netlify env:set VITE_APP_NAME "My App"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJhbGci..."
```

At minimum, set these in Netlify:
- `VITE_APP_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Security Notes

- **Never commit** `.env` to git
- **Never expose** `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- `VITE_*` variables are embedded in the frontend bundle and are **publicly visible**
- `SUPABASE_SERVICE_ROLE_KEY` is only used in Netlify Functions (server-side)
- `OPENAI_API_KEY` and `EMAIL_API_KEY` are server-side only

---

## Quick Reference

```bash
# ── Required ──────────────────────────────────────
VITE_APP_NAME=My App
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_URL=https://abc123.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ── Optional ──────────────────────────────────────
# SITE_URL=https://app.mycompany.com
# OPENAI_API_KEY=sk-...
# EMAIL_PROVIDER=resend
# EMAIL_API_KEY=re_...
# EMAIL_FROM=noreply@mycompany.com
# EMAIL_WEBHOOK_URL=https://hook.us1.make.com/...
# SPINE_INTEGRITY=enforce
```

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Build pipeline that uses these variables
- [AI-AND-EMBEDDINGS.md](AI-AND-EMBEDDINGS.md) — OPENAI_API_KEY usage
- [INTEGRATIONS.md](INTEGRATIONS.md) — Email provider configuration
