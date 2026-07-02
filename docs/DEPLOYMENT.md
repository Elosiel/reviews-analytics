# Deployment Guide — app.reviewsanalytics.ai

Step-by-step path from this repo to a live app your restaurant partner can sign
into. Do the steps in order — later steps depend on values created in earlier ones.

**The stack:**

| Piece | Service | Role |
|---|---|---|
| Code + CI | GitHub | Source of truth, auto-deploys on push |
| Hosting | Vercel | Runs the Next.js app |
| Database + Auth | Supabase | Postgres, RLS, sign-in, pg_cron jobs |
| Domain / DNS | Porkbun | `reviewsanalytics.ai` + `app.` subdomain |
| Google data | Google Cloud | OAuth + Business Profile API (pending approval) |
| Email | Resend | Weekly Monday digest |
| AI | Anthropic | Claude sentiment analysis |

---

## Phase 1 — Live demo dashboard (do this now)

Gets you a working `app.reviewsanalytics.ai` with email/password login and demo
data. No Google approval needed. Roughly 1–2 hours.

### Step 1 · Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
   - Name: `reviews-analytics`
   - Region: closest to your users (e.g. `us-east-1`)
   - Save the database password somewhere safe
2. Once provisioned, open **SQL Editor** → paste the full contents of
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**
3. Collect your keys from **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

### Step 2 · Create the demo login

Email/password auth is enabled by default in Supabase. Create the account:

1. **Authentication → Users → Add user → Create new user**
2. Email: e.g. `demo@reviewsanalytics.ai` · Password: something strong
3. ✅ Check **Auto Confirm User** (skips the confirmation email)
4. Repeat for your restaurant partner when you're ready to give them access

Optionally, under **Authentication → Sign In / Up**, disable **Sign ups**
so only accounts you create can log in (the app has no public sign-up form,
but this closes the API path too).

### Step 3 · Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import
   `Elosiel/reviews-analytics` from GitHub
2. Framework preset: **Next.js** (auto-detected). Leave build settings default.
3. Add **Environment Variables** (Production + Preview):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Step 1 |
   | `NEXT_PUBLIC_APP_URL` | `https://app.reviewsanalytics.ai` |
   | `TOKEN_ENCRYPTION_KEY` | run `openssl rand -hex 32` |
   | `CRON_SECRET` | run `openssl rand -hex 32` (save it — needed in Step 6) |
   | `ANTHROPIC_API_KEY` | from [console.anthropic.com](https://console.anthropic.com) |
   | `RESEND_API_KEY` | from Step 5 (can add later) |
   | `RESEND_FROM` | `Reviews Analytics <digest@reviewsanalytics.ai>` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Phase 2 (can add later) |

4. **Deploy.** Every future push to `main` auto-deploys; every PR gets a preview URL.

### Step 4 · Point the domain (Porkbun)

1. In Vercel: project → **Settings → Domains** → add `app.reviewsanalytics.ai`
2. In Porkbun: `reviewsanalytics.ai` → **DNS Records** → add:
   - Type: `CNAME` · Host: `app` · Answer: `cname.vercel-dns.com` · TTL: 600
3. Back in Vercel, wait for the domain check to turn green (minutes, up to an hour)
4. HTTPS is automatic (Vercel provisions the certificate)

> The root domain `reviewsanalytics.ai` (marketing site) stays wherever it's
> hosted today — its "Sign in" button just links to `https://app.reviewsanalytics.ai/login`.

**✅ Checkpoint:** open `https://app.reviewsanalytics.ai/login`, sign in with the
demo credentials from Step 2, and you should land on the dashboard with demo data.
This is the link you show the restaurant owner.

### Step 5 · Resend (weekly digest email)

1. [resend.com](https://resend.com) → **Domains → Add Domain** → `reviewsanalytics.ai`
2. Resend shows 3–4 DNS records (SPF, DKIM, MX for bounces) — add each in
   Porkbun DNS exactly as shown, then click **Verify** in Resend
3. **API Keys → Create API Key** → set `RESEND_API_KEY` in Vercel → redeploy

### Step 6 · Wire up the scheduled jobs

The schema already registers three pg_cron jobs (text purge, weekly digest,
6-hour reconciliation poll). The two that call the app need to know where it
lives. In the Supabase **SQL Editor**, run:

```sql
alter database postgres set app.base_url = 'https://app.reviewsanalytics.ai';
alter database postgres set app.cron_secret = '<the CRON_SECRET value from Step 3>';
```

Verify the jobs exist: `select jobname, schedule from cron.job;` — you should see
`purge-review-text`, `weekly-digest`, and `review-reconciliation-poll`.

---

## Phase 2 — Real Google data (after API approval)

Blocked on Google Business Profile API access approval. Do the request early —
it takes days to weeks.

### Step 7 · Google Cloud project + API access request

1. [console.cloud.google.com](https://console.cloud.google.com) → **New Project**
   → `reviews-analytics`
2. Request Business Profile API access via
   [Google's GBP API contact form](https://developers.google.com/my-business/content/prereqs)
   — describe the product truthfully: *read-only review analytics for
   multi-location restaurant groups; never posts or replies*
3. Once approved, enable in **APIs & Services → Library**:
   - Google My Business API (Business Profile APIs)
   - My Business Account Management API
   - My Business Business Information API

### Step 8 · OAuth consent screen + credentials

1. **APIs & Services → OAuth consent screen**:
   - User type: **External** · App name: `Reviews Analytics`
   - Authorized domain: `reviewsanalytics.ai`
   - Scopes: `https://www.googleapis.com/auth/business.manage`
     (narrowest scope Google offers for reading reviews)
2. **Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**
   - Authorized redirect URIs:
     - `https://app.reviewsanalytics.ai/api/google/callback`
     - `http://localhost:3000/api/google/callback` (dev)
3. Copy client ID + secret → set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   in Vercel → redeploy
4. While the consent screen is in **Testing** mode, add your restaurant
   partner's Google account under **Test users** — that's enough for the pilot;
   full verification can come later

### Step 9 · (Optional) Google sign-in via Supabase

The login page also has a "Continue with Google" button, powered by Supabase Auth:

1. Supabase → **Authentication → Sign In / Up → Google** → enable
2. Paste the same Google client ID/secret
3. Add Supabase's callback URL (shown in that screen, ends in
   `/auth/v1/callback`) to the Google OAuth client's redirect URIs

Until this is configured the button shows a friendly "not available yet" message
and email/password keeps working.

### Step 10 · Onboard the restaurant partner

1. They sign in at `app.reviewsanalytics.ai` → `/onboarding`
2. They click **Connect Google Business Profile** (their account must be a
   listed test user, Step 8.4)
3. They select which locations to track → first sync pulls review history →
   Claude categorizes each review → rollups compute → dashboard goes live
   with real data
4. Monday 07:00 UTC: they get their first weekly digest

---

## Launch checklist

- [ ] Supabase project created, `schema.sql` run
- [ ] Demo user created (Auto Confirm ✅), public sign-ups disabled
- [ ] Vercel project deployed with all env vars
- [ ] `app.reviewsanalytics.ai` CNAME added at Porkbun, green in Vercel
- [ ] Demo login works end-to-end on the production URL
- [ ] Resend domain verified, API key set
- [ ] `app.base_url` + `app.cron_secret` set in the database, cron jobs listed
- [ ] GBP API access request submitted (start early!)
- [ ] OAuth consent screen + credentials configured, partner added as test user
- [ ] Marketing site "Sign in" button points to `https://app.reviewsanalytics.ai/login`

## Troubleshooting

- **`No Output Directory named "build" found after the Build completed`** —
  the Vercel project's Framework Preset is set to "Other" instead of Next.js.
  The repo's `vercel.json` (`"framework": "nextjs"`) forces the correct
  framework, but you can also fix the setting under **Project Settings →
  Build & Development Settings → Framework Preset → Next.js**.
- **Login redirects back to /login** — Supabase URL/anon key missing or wrong in
  Vercel env; check they're set for the Production environment and redeploy.
- **`relation "cron.job" does not exist`** — pg_cron extension didn't enable;
  re-run the extensions block at the top of `schema.sql`.
- **Digest never arrives** — check `select * from cron.job_run_details order by
  start_time desc limit 10;` in Supabase, and confirm `app.base_url` has no
  trailing slash and `app.cron_secret` matches Vercel's `CRON_SECRET`.
- **Google connect fails with redirect_uri_mismatch** — the redirect URI in the
  Google OAuth client must match `NEXT_PUBLIC_APP_URL` + `/api/google/callback`
  exactly (scheme, host, path).
