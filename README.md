# Lens

Create reusable Moves, Functions, and contextual Lenses, then apply them to material through a server-only model gateway.

- **Make a symbol** — give it a name, icon, color, and a prompt (e.g. "Summarize", "Fix grammar", "Translate to French").
- **Drop it on text** — type/paste text, optionally select part of it, then drag a symbol onto the text box. The model runs the prompt on that text.
- **Apply the result** — replace the text (or just the selection) with the model's output, or copy it.

Symbols are saved in your browser (localStorage). Your API token stays on the server.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Vercel AI Gateway API key in the Vercel dashboard and add it locally:

   ```bash
   cp .env.example .env
   # then edit .env and set AI_GATEWAY_API_KEY=...
   ```

3. Run it (starts the API server + the web app):

   ```bash
   npm run dev
   ```

   Open the app at http://localhost:5173

## Production (self-hosted)

```bash
npm run build   # builds the web app into ./dist
npm start       # serves the app + API on http://localhost:8787
```

## Deploy to Vercel

This repo is Vercel-ready. The web app is built statically and the backend runs
as serverless functions in `api/` (`/api/run`, `/api/health`).

1. Import the GitHub repo into Vercel (or run `vercel`).
2. Enable Vercel OIDC for the project (recommended; `VERCEL_OIDC_TOKEN` is injected automatically), or add an AI Gateway API key:

   | Name       | Value                        |
   | ---------- | ---------------------------- |
   | `AI_GATEWAY_API_KEY` | optional when deployment OIDC is enabled; useful for explicit key budgets |
   | `VITE_SUPABASE_URL` | _(optional)_ Supabase project URL |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | _(optional)_ `sb_publishable_…` key |
   | `SUPABASE_SECRET_KEY` | _(optional)_ server secret for JWT auth |

   (Optionally set task profile preferences such as `AI_GATEWAY_MODEL_MOVE`, `AI_GATEWAY_MODEL_FUNCTION`, `AI_GATEWAY_MODEL_LENS_ENCODING`, or `SUPABASE_REQUIRE_AUTH=true`.)
3. Deploy. Vercel uses `vercel.json`: build command `npm run build`, output `dist`.

**Production URL:** [https://representation-eta.vercel.app](https://representation-eta.vercel.app)

> **Note:** `representation.vercel.app` is a different, unrelated Vercel project
> (an old Create React App). This repo deploys to the `representation` project
> under `tane-kims-projects`, aliased to `representation-eta.vercel.app`.

> Never put your API token in the code or commit it. Set it only in Vercel's
> Environment Variables (or your local `.env`, which is gitignored).

## Configuration

Set these in `.env`:

| Variable          | Default                              | Description                                        |
| ----------------- | ------------------------------------ | -------------------------------------------------- |
| `AI_GATEWAY_API_KEY` | _(local/self-hosted)_             | Vercel AI Gateway key; server only                 |
| `VERCEL_OIDC_TOKEN` | _(automatic on Vercel)_            | Deployment identity used when no API key is set    |
| `AI_GATEWAY_MODEL_*` | `Auto`                            | Optional compatible model preference per task      |
| `MODEL_GATEWAY_ALLOW_DIRECT_FALLBACK` | `false`          | Explicitly permit the legacy direct provider adapter |
| `HF_TOKEN`        | _(fallback only)_                    | Used only when direct fallback is explicitly enabled |
| `PORT`            | `8787`                               | API server port                                    |
| `VITE_SUPABASE_URL` | _(optional)_                       | Supabase project URL (client accounts & cloud sync)|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | _(optional)_           | Supabase publishable key (`sb_publishable_…`)    |
| `SUPABASE_URL`    | _(optional)_                         | Same URL for server JWT verification               |
| `SUPABASE_SECRET_KEY` | _(optional)_                     | Secret key for server-side auth (`sb_secret_…`)    |
| `SUPABASE_REQUIRE_AUTH` | `false`                        | When `true`, AI endpoints require a signed-in JWT  |

## Accounts & plans (Supabase)

Lens can run without accounts — the canvas stays in your browser. With Supabase configured, you get email/password sign-up, password reset, plan tiers (Free/Pro display), and **cloud board sync** so your work follows you across devices.

### Local development

1. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
2. Start the local stack and apply migrations + seed:

   ```bash
   supabase start
   supabase db reset
   ```

3. Copy keys from `supabase status` into `.env`:

   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key from supabase status>
   ```

4. Run `npm run dev` and open http://localhost:5173. Sign-up emails appear in the CLI mail viewer (`supabase status` shows the Inbucket URL).

### Hosted project checklist

Before inviting non-team users:

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the project URL and **publishable** key into Vercel env vars as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Copy the **secret** key as `SUPABASE_SECRET_KEY` (server only).
3. **Authentication → URL Configuration**: set **Site URL** to your production URL; add `http://localhost:5173` and preview URLs to **Redirect URLs**. Under implicit flow, every allowlisted URL can receive session tokens — keep the list tight.
4. Enable **email confirmations**, **minimum password length 8**, and email link expiry ≤ 1 hour (matches `supabase/config.toml`).
5. Apply migrations: `supabase link --project-ref <ref>` then `supabase db push`. Run `supabase/seed.sql` in the SQL editor (or `supabase db reset` locally).
6. Configure **custom SMTP** before public launch — the built-in email service (~2/hour, team members only) is not suitable for production signups.

> **Build note:** `VITE_` vars are inlined at build time. A Vercel deploy without them ships the auth-less app (one console warning). Set them in **Project Settings → Environment Variables** for Production and Preview.

### What syncs to the cloud

When signed in, board state (canvas items, pages, title, operators, lenses, transformations) syncs to the `board_snapshots` table. localStorage remains the offline cache; the newer snapshot wins on sign-in. AI history and in-flight jobs stay local.

### Optional: require sign-in for AI

Set `SUPABASE_SECRET_KEY` and `SUPABASE_REQUIRE_AUTH=true` on the server to gate `/api/run`, `/api/execute`, `/api/phase`, and `/api/pipeline`. The client sends the session JWT automatically when signed in.
