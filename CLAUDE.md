# Reviews Analytics — App Dashboard (app.reviewsanalytics.ai)

> This file is the single source of truth for this codebase.
> If anything else contradicts this file, THIS FILE WINS.

## What this product is

**One line:** A review-sentiment intelligence engine that reads every Google review — across one location or fifty — and hands the owner a ranked operational to-do list: what's costing them stars, and where.

**Read-only.** It never posts, replies, or drafts anything on the tenant's behalf.

## What this product is NOT

The following do not exist in this codebase. Do not reference, resurrect, or extend them:
- Brand voice profiles or AI-drafted replies
- Approve / edit / reject states
- `pending` / `published` / `publish_failed` state machine
- Twilio SMS approval links
- Auto-publish logic
- Guest recovery flows

If a future "respond" tier is built, it is a separate scoping conversation — not an extension of this one.

## ICP (locked)

Multi-location independent restaurant group (3–15 locations, full-service).
The moat is **cross-location comparison** — which location is the weak link, on what category.
Solo-owner signups are not rejected but the product is built for the group buyer first.

## Scope of this repo

Production app at `app.reviewsanalytics.ai` ONLY.
Marketing site (`reviewsanalytics.ai`) is a separate repo — do not touch it here.

---

## Tech Stack (do not propose changing)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database + Auth | Supabase (PostgreSQL + RLS + Supabase Auth) |
| Scheduled jobs | pg_cron inside Postgres |
| AI / Sentiment | Anthropic Claude — no OpenAI |
| Email (digest) | Resend |
| Google data | Google Business Profile API (read-only OAuth) |

---

## Architecture

```
src/
  app/
    (auth)/login/                  # Google sign-in
    (dashboard)/dashboard/
      locations/                   # Cross-location roll-up view
      reports/                     # Per-location ranked issue list
      settings/                    # Account + Google connection
    api/
      google/callback/             # OAuth callback + token store
      reviews/sync/                # Review ingest (Pub/Sub push + reconciliation poll)
      reviews/analyze/             # Trigger Claude analysis per review
      digest/send/                 # Weekly Monday digest (called by pg_cron)
      locations/                   # Location CRUD
  components/
    dashboard/                     # Ranked issues, cross-location rollup, drift alerts
    charts/                        # Sentiment trend charts (90-day default)
    layouts/                       # Sidebar, shell
    shared/
  lib/
    supabase/client.ts             # Browser client
    supabase/server.ts             # Server client (SSR)
    google/oauth.ts                # OAuth helpers (read-only scope)
    google/business-profile.ts     # GBP API: reviews.list, batchGetReviews
  types/index.ts                   # All domain types
  middleware.ts                    # Auth guard
supabase/schema.sql                # DB schema + RLS + pg_cron jobs
```

---

## Fixed Category Taxonomy

**food · service · atmosphere · value · wait_time · cleanliness**

These are locked. Do not let the AI model invent categories per-review —
rankings become incomparable across reviews and locations if categories vary.
Every review is categorized regardless of star rating (5★ reviews power "what they love").

---

## Drift Alert Thresholds (paper-agreed)

| Severity | Condition |
|---|---|
| medium | sentiment_delta < −0.2 over the 30-day window |
| high | sentiment_delta < −0.4 over the 30-day window |

Change only after design-partner feedback — not by feel.

---

## Weekly Report Structure (locked)

The weekly report — on-screen (`ReportDetailModal.tsx`) and the downloaded PDF
(`src/lib/reports/weekly-report-html.ts`, rasterized by
`src/lib/reports/download-weekly-report-pdf.ts`) — always renders in this
exact order:

1. Header (period dates)
2. Score-scale note ("how to read these scores")
3. Danger alerts — **the only section whose presence is a variable.** It renders
   only when `needs_attention` has entries; every other section below is a
   permanent part of the template (an individual section may still show fewer
   or no cards when there's no data for it that period — that's a data
   condition, not a structural change).
4. Executive summary
5. Location ranking
6. Good themes
7. Bad themes
8. Recommended actions
9. Category heatmap (always last)

This is the model for every future report. Do not reorder sections, drop one, or
add a new one without a deliberate decision — new content slots into one of
these sections, or (rarely) appends after the heatmap. Keep `ReportDetailModal.tsx`
and `weekly-report-html.ts` describing the same structure — they must never drift
apart.

---

## 30-Day Verbatim Text Rule (non-negotiable)

Google API ToS: `review_text` and `reviewer_name` may only be cached 30 days.
- `content_purge_at` = `ingested_at + 30 days` (generated column in DB)
- pg_cron nulls `review_text` / `reviewer_name` daily at 03:00 UTC
- Derived data (category scores, star_rating, dates) is retained indefinitely
- Verbatim quotes in the dashboard are ONLY from the rolling 30-day window
- Frame as "what guests are saying right now" — a feature, not an apology

---

## Multi-tenancy

- Every customer-data table carries `tenant_id`
- RLS enforced via Postgres session variable `app.current_tenant_id`
- Set with `SELECT set_tenant('uuid')` — NEVER from request params
- Two roles: `operator` (admin, service-role) · `tenant` (RLS-scoped)

---

## Key Product Rules

1. **Dashboard always reads from `category_rollups`** — never a live join over raw reviews
2. **Rollup is recomputed by pg_cron every 6h** + after every reconciliation poll
3. **Weekly digest** sent Monday 07:00 UTC via Resend — no per-tenant timezone in v1
4. **Shift meeting card** = per-issue export with problem + location + mention count + 3–4 quotes
5. **Proof-of-impact view** = when a flagged category recovers, surface the before/after delta explicitly
6. **Danger flags** (health_safety, legal, discrimination, physical_safety) are surfaced as `needs_attention` in UI regardless of category
7. **Connection broken** = set `locations.connection_broken = true` + send email alert on OAuth refresh failure

---

## Critical-Path Gates (not yet cleared)

1. Google Business Profile read-only API access approved?
2. Signed multi-location design partner willing to connect real locations + give weekly feedback?

The bottleneck is selling and approval — not architecture.

---

## Environment

Copy `.env.local.example` → `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` + keys
- `TOKEN_ENCRYPTION_KEY` — 32-byte hex for AES-256 token encryption (`openssl rand -hex 32`)
- `CRON_SECRET` — shared secret between pg_cron and API routes
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY` + `RESEND_FROM`

---

## Pricing (transparent in dashboard)

- Standard: $89/location/month (4 locations = $356/mo — show this math in UI)
- Enterprise: custom — row-level isolation per venue + roll-up reporting

---

## Dev Commands

```bash
npm run dev     # Start dev server on localhost:3000
npm run build   # Production build
npm run lint    # ESLint
```
