# Reviews Analytics — App Dashboard

Production app for **app.reviewsanalytics.ai** — a review-sentiment intelligence
engine that reads every Google review across a restaurant group's locations and
hands the owner a ranked operational to-do list: what's costing them stars, and where.

**Read-only.** It never posts, replies, or drafts anything on the tenant's behalf.

> The marketing site (`reviewsanalytics.ai`) lives in a separate repo. This repo is
> the app dashboard only. See [`CLAUDE.md`](./CLAUDE.md) for the full product spec.

## Stack

Next.js (App Router) + TypeScript · shadcn/ui + Tailwind v4 · Supabase (Postgres,
RLS, Auth) · pg_cron · Anthropic Claude (sentiment) · Resend (weekly digest) ·
Google Business Profile API (read-only OAuth)

## Quick start (local)

```bash
npm install
cp .env.local.example .env.local   # fill in at least the Supabase values
npm run dev                        # http://localhost:3000
```

Minimum to run locally: a free [Supabase](https://supabase.com) project.
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`,
then run `supabase/schema.sql` in the Supabase SQL Editor.

### Demo login (before Google API approval)

Google Business Profile API access is pending approval, so the app supports
**email + password sign-in** for demos and design partners:

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**
2. Enter an email + password, check **Auto Confirm User**, create
3. Sign in at `/login` with those credentials — the dashboard renders with
   realistic demo data until real locations are connected

## Deploying to production

Full step-by-step guide (Supabase → Vercel → Porkbun DNS → Google Cloud → Resend):
**[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**

## Commands

```bash
npm run dev     # Dev server on localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```
