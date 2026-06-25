# Reviews Analytics — App Dashboard

## Product
SaaS dashboard at **https://app.reviewsanalytics.ai** for restaurant operators.
Landing page: **https://reviewsanalytics.ai**

Turns Google Business Profile reviews into a prioritized operational to-do list using sentiment analysis. Targets restaurant owners and multi-location groups.

## Tech Stack
- **Framework**: Next.js (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4
- **Database + Auth**: Supabase (PostgreSQL + RLS + Supabase Auth)
- **Google Integration**: Google Business Profile API via OAuth 2.0

## Architecture
```
src/
  app/
    (auth)/login/          # Login page (Google sign-in)
    (dashboard)/dashboard/ # Main app — protected by middleware
      locations/           # Multi-location overview
      reports/             # Detailed reports per location
      settings/            # Account & integrations
    api/
      google/              # OAuth callback + token management
      reviews/             # Review sync + analysis endpoints
      locations/           # Location CRUD
  components/
    dashboard/             # Dashboard-specific components
    charts/                # Recharts/chart wrappers
    layouts/               # Sidebar, header, shell
    shared/                # Reusable UI pieces
  lib/
    supabase/client.ts     # Browser Supabase client
    supabase/server.ts     # Server Supabase client
    google/oauth.ts        # Google OAuth helpers
    google/business-profile.ts  # GBP API client
  types/index.ts           # All TypeScript types
  middleware.ts            # Auth guard (Supabase SSR)
supabase/schema.sql        # Full DB schema + RLS policies
```

## Key Domain Concepts
- **SentimentCategory**: food | service | atmosphere | value | wait_time | cleanliness
- **DriftAlert**: auto-detected declining category trends
- Reviews are pulled via Google Business Profile API, stored in Supabase, analyzed per category

## Environment
Copy `.env.local.example` to `.env.local` and fill in:
- Supabase URL + keys (from supabase.com dashboard)
- Google OAuth credentials (from Google Cloud Console)
  - Enable: "Google Business Profile API" + "My Business Business Information API"
  - OAuth redirect: https://app.reviewsanalytics.ai/api/google/callback
  - Local dev redirect: http://localhost:3000/api/google/callback

## Pricing
- Standard: $89/location/month
- Enterprise: custom (multi-brand, row-level isolation)

## Dev Commands
```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
```
