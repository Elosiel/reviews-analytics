-- Reviews Analytics — Supabase Schema
-- Single source of truth. Run this in your Supabase SQL editor.
-- Product: read-only sentiment intelligence for multi-location restaurant groups.
-- NOTHING in this schema posts, replies, or drafts on behalf of the tenant.

-- ── Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";        -- scheduled jobs (purge, rollup, digest)
create extension if not exists "pg_net";         -- HTTP calls from cron jobs to API routes
create extension if not exists "pgcrypto";       -- for encrypting OAuth tokens at rest

-- ─────────────────────────────────────────────────────────────────
-- AUTH & TENANCY
-- Every customer-data table carries tenant_id.
-- RLS is enforced via a Postgres session variable (app.current_tenant_id),
-- NOT from request params. Never bypass with service-role outside admin routes.
-- ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  tenant_id     uuid not null default uuid_generate_v4(), -- org-level key for RLS
  email         text not null,
  full_name     text,
  avatar_url    text,
  role          text not null default 'tenant' check (role in ('operator','tenant')),
  plan          text not null default 'trial',  -- trial | standard | enterprise
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Helper: set session-level tenant for RLS (used by service-role/admin jobs
-- that run their own transaction — pg_cron, reconciliation, digest).
create or replace function public.set_tenant(p_tenant_id uuid)
returns void language plpgsql security definer as $$
begin
  perform set_config('app.current_tenant_id', p_tenant_id::text, true);
end;
$$;

-- Helper: the logged-in user's tenant, resolved from their profile row.
-- This is what user-facing RLS keys off — the Supabase JS client sends a
-- user JWT (auth.uid()) but can't set a per-request session variable, so
-- policies on tables the app writes from the browser/SSR must derive the
-- tenant from auth.uid(), not from app.current_tenant_id.
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

-- ── Restaurant profile — the AI's context for recommendations ─────
-- Collected at onboarding, editable on the "Your restaurant" page.
-- Fed into the Claude prompt so recommendations match the restaurant's
-- mission, guests, price point, and goals. One row per tenant.
create table public.tenant_profiles (
  tenant_id     uuid primary key,
  mission       text not null default '',
  cuisine_style text not null default '',
  target_guests text not null default '',
  price_point   text not null default '$$' check (price_point in ('$','$$','$$$','$$$$')),
  goals         text not null default '',
  notes         text not null default '',
  website_url   text not null default '',  -- AI reads it for voice + facts
  menu_url      text not null default '',  -- online menu, if separate from the site
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.tenant_profiles enable row level security;
-- Keyed off the logged-in user's tenant so the app can read/write it with
-- the standard anon+JWT client. (USING also gates INSERT/UPDATE here since
-- no separate WITH CHECK is given.)
create policy tenant_profiles_isolation on public.tenant_profiles
  for all using (tenant_id = public.auth_tenant_id());

-- ── Restaurant documents — uploaded context for the AI ────────────
-- Menus, promotions, wine lists, brand notes uploaded on the
-- "Your restaurant" page. Files live in the private 'tenant-docs'
-- Storage bucket at {tenant_id}/{document_id}/{file_name}; this table
-- holds metadata + the extracted text the Claude prompt consumes.
-- Tenant documents are the tenant's own material — no 30-day purge
-- (that rule is for Google review verbatims only).
create table public.tenant_documents (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null,
  kind           text not null default 'other'
                 check (kind in ('menu','promotion','wine_list','brand','policy','other')),
  title          text not null,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null,
  storage_path   text not null,            -- path inside the tenant-docs bucket
  extracted_text text,                     -- filled by the extraction job; null = processing
  status         text not null default 'processing'
                 check (status in ('processing','ready')),
  uploaded_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index tenant_documents_tenant_idx on public.tenant_documents (tenant_id, uploaded_at desc);

alter table public.tenant_documents enable row level security;
create policy tenant_documents_isolation on public.tenant_documents
  for all using (tenant_id = public.auth_tenant_id());

-- ── Storage: private bucket for the uploaded files ────────────────
-- Files live at {tenant_id}/{document_id}/{file_name}. RLS on the
-- objects mirrors the table: a user only touches their own tenant folder.
insert into storage.buckets (id, name, public)
  values ('tenant-docs', 'tenant-docs', false)
  on conflict (id) do nothing;

create policy "tenant docs read" on storage.objects for select
  using (bucket_id = 'tenant-docs'
         and (storage.foldername(name))[1] = public.auth_tenant_id()::text);
create policy "tenant docs insert" on storage.objects for insert
  with check (bucket_id = 'tenant-docs'
         and (storage.foldername(name))[1] = public.auth_tenant_id()::text);
create policy "tenant docs delete" on storage.objects for delete
  using (bucket_id = 'tenant-docs'
         and (storage.foldername(name))[1] = public.auth_tenant_id()::text);

-- ── Google OAuth tokens — encrypted at rest ────────────────────────
-- access_token and refresh_token are stored encrypted (pgcrypto).
-- The encryption key comes from the app env, never the DB.
-- NEVER log or return these raw.
create table public.google_tokens (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  access_token_enc  bytea not null,   -- AES-256 encrypted
  refresh_token_enc bytea not null,   -- AES-256 encrypted
  expires_at        bigint not null,
  scope             text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(user_id)
);

-- ─────────────────────────────────────────────────────────────────
-- LOCATIONS
-- ─────────────────────────────────────────────────────────────────

create table public.locations (
  id                   uuid primary key default uuid_generate_v4(),
  tenant_id            uuid not null,
  user_id              uuid references public.profiles(id) on delete cascade not null,
  google_account_id    text not null,
  google_location_id   text not null,
  name                 text not null,
  address              text,
  rating               numeric(3,2),
  review_count         int default 0,
  connection_broken    boolean not null default false,  -- flag when OAuth refresh fails
  connection_broken_at timestamptz,
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(tenant_id, google_location_id)
);

-- ─────────────────────────────────────────────────────────────────
-- REVIEWS (canonical ingest — 30-day text purge rule)
--
-- Verbatim review_text and reviewer_name may only be cached 30 days
-- (Google API ToS). Derived data (category, score, star_rating, date)
-- is retained indefinitely — this powers trend charts and rankings.
-- content_purge_at is set to ingested_at + 30 days.
-- pg_cron nulls review_text / reviewer_name at the boundary.
-- ─────────────────────────────────────────────────────────────────

create table public.reviews (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null,
  location_id         uuid references public.locations(id) on delete cascade not null,
  external_review_id  text not null,          -- Google review id
  source              text not null default 'google',
  star_rating         int not null check (star_rating between 1 and 5),
  review_text         text,                   -- nulled at content_purge_at
  reviewer_name       text,                   -- nulled at content_purge_at
  reviewed_at         timestamptz not null,   -- when the guest wrote the review
  ingested_at         timestamptz not null default now(),
  content_purge_at    timestamptz not null,  -- set by trigger: ingested_at + 30 days
  status              text not null default 'ingested',
  unique(tenant_id, external_review_id)
);

-- Trigger: auto-set content_purge_at = ingested_at + 30 days on insert
-- (Can't use a generated column — timestamptz + interval is STABLE not IMMUTABLE in PG)
create or replace function public.set_content_purge_at()
returns trigger language plpgsql as $$
begin
  new.content_purge_at := new.ingested_at + interval '30 days';
  return new;
end;
$$;

create trigger set_review_purge_at
  before insert on public.reviews
  for each row execute procedure public.set_content_purge_at();

-- ─────────────────────────────────────────────────────────────────
-- REVIEW ANALYSES (per-review AI output)
--
-- Fixed taxonomy — do NOT let the model invent categories.
-- Categories: food | service | atmosphere | value | wait_time | cleanliness
-- A single review can hit multiple categories.
-- All reviews are categorized regardless of star rating
-- (5★ reviews power "what they love" — positive sentiment matters too).
-- danger_flags are surfaced in the dashboard regardless of category.
-- ─────────────────────────────────────────────────────────────────

create table public.review_analyses (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null,
  review_id   uuid references public.reviews(id) on delete cascade not null,
  model_used  text not null default 'claude',
  -- danger flags — highlighted in UI even with no publish path
  flag_health_safety    boolean not null default false,
  flag_legal            boolean not null default false,
  flag_discrimination   boolean not null default false,
  flag_physical_safety  boolean not null default false,
  needs_attention       boolean not null generated always as (
    flag_health_safety or flag_legal or flag_discrimination or flag_physical_safety
  ) stored,
  analyzed_at  timestamptz not null default now(),
  unique(review_id)
);

-- Per-category sentiment scores for each review
create table public.review_categories (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null,
  analysis_id     uuid references public.review_analyses(id) on delete cascade not null,
  review_id       uuid references public.reviews(id) on delete cascade not null,
  category        text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  sentiment_score numeric(4,3) not null,  -- -1.000 to 1.000
  confidence      numeric(4,3) not null,  -- 0.000 to 1.000
  sentiment       text not null generated always as (
    case
      when sentiment_score > 0.1  then 'positive'
      when sentiment_score < -0.1 then 'negative'
      else 'neutral'
    end
  ) stored
);

-- ─────────────────────────────────────────────────────────────────
-- CATEGORY ROLLUPS (pre-aggregated — never live-join raw reviews)
--
-- Computed by pg_cron job (every 6h + after every reconciliation poll).
-- Dashboard + digest both read from this table, not from raw reviews.
-- window_end is always the end of the most recent complete day.
-- ─────────────────────────────────────────────────────────────────

create table public.category_rollups (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null,
  location_id         uuid references public.locations(id) on delete cascade not null,
  category            text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  window_days         int not null,          -- 7, 30, 90
  window_end          date not null,
  mention_count       int not null default 0,
  positive_count      int not null default 0,
  negative_count      int not null default 0,
  neutral_count       int not null default 0,
  avg_sentiment_score numeric(4,3),
  -- week-over-week signed delta (set by the rollup job)
  sentiment_delta     numeric(4,3),          -- current_avg - prior_period_avg
  computed_at         timestamptz not null default now(),
  unique(tenant_id, location_id, category, window_days, window_end)
);

-- ─────────────────────────────────────────────────────────────────
-- DRIFT ALERTS
--
-- A drift alert fires when a category's sentiment_delta crosses the
-- agreed threshold (defined in the rollup job, not here).
-- Threshold decision: delta < -0.2 over the 30-day window triggers 'medium';
-- delta < -0.4 triggers 'high'. These are the paper-agreed numbers —
-- adjust only after design-partner feedback, not by feel.
-- ─────────────────────────────────────────────────────────────────

create table public.drift_alerts (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null,
  location_id  uuid references public.locations(id) on delete cascade not null,
  category     text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  severity     text not null check (severity in ('low','medium','high')),
  -- The before/after deltas must be stored — they power the proof-of-impact view
  score_before numeric(4,3) not null,
  score_after  numeric(4,3) not null,
  delta        numeric(4,3) not null generated always as (score_after - score_before) stored,
  message      text not null,
  detected_at  timestamptz not null default now(),
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  -- Proof-of-impact: when a flagged category recovers, surface this explicitly
  recovery_score numeric(4,3),
  recovered_at   timestamptz
);

-- ─────────────────────────────────────────────────────────────────
-- SOPs (Standard Operating Procedures)
--
-- Brand-wide, one per category — matches how restaurant groups actually
-- standardize operations (the moat is cross-location comparison, not
-- per-location documents). AI drafts a suggestion when a category shows
-- sustained negative drift (an unresolved drift_alert with no active SOP
-- yet); a manager reviews, edits, and activates it. RAAI never auto-
-- publishes or silently updates an SOP a team is expected to follow.
--
-- Evidence quotes live in a separate snapshot table so they can carry
-- their own 30-day purge clock inherited from the source review — the
-- SOP's own title/content is the tenant's derived work product and is
-- retained indefinitely, same split as everywhere else in this schema.
-- ─────────────────────────────────────────────────────────────────

create table public.sops (
  id                     uuid primary key default uuid_generate_v4(),
  tenant_id              uuid not null,
  category               text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  title                  text not null,
  content                text not null,
  status                 text not null default 'draft' check (status in ('draft','active','archived')),
  ai_generated           boolean not null default true,
  -- What triggered the draft, e.g. "Drafted from a high drift alert at
  -- Wynwood — service down 0.31 over 30 days."
  source_summary         text,
  source_drift_alert_id  uuid references public.drift_alerts(id) on delete set null,
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  activated_at           timestamptz
);

-- Only one active SOP per category per tenant — a brand-wide standard,
-- not a per-location document. Drafts/archived copies can coexist.
create unique index sops_one_active_per_category
  on public.sops (tenant_id, category)
  where (status = 'active');

create index sops_tenant_idx on public.sops (tenant_id, category);

-- Evidence quotes backing an SOP draft. content_purge_at is copied from
-- the source review at insert time (NOT a fresh 30-day timer) — a quote
-- disappears exactly when the review it came from would have. The daily
-- purge job below nulls quote_text here the same way it nulls
-- reviews.review_text.
create table public.sop_evidence_quotes (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null,
  sop_id            uuid references public.sops(id) on delete cascade not null,
  review_id         uuid references public.reviews(id) on delete set null,
  location_id       uuid references public.locations(id) on delete set null,
  location_name     text not null,
  quote_text        text,              -- nulled at content_purge_at
  star_rating       int,
  reviewed_at       timestamptz,
  content_purge_at  timestamptz not null
);

create index sop_evidence_quotes_sop_idx on public.sop_evidence_quotes (sop_id);

-- ─────────────────────────────────────────────────────────────────
-- MEETINGS
--
-- On-demand, manager-generated agendas: pick location(s)/city/date range/
-- category filters, RAAI builds discussion points + suggested actions
-- from category_rollups and ranked issues, and saves it to a filterable
-- history. No auto-weekly generation in v1 — the manager controls timing
-- around their actual meeting schedule, and Claude spend stays predictable.
-- ─────────────────────────────────────────────────────────────────

create table public.meetings (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null,
  title         text not null,
  -- Filters used to generate this meeting — null/empty means "all"
  location_ids  uuid[],
  city          text,
  categories    text[],
  date_start    date not null,
  date_end      date not null,
  -- Discussion points + suggested actions, keyed by category/location —
  -- paraphrased analysis only, no verbatim text (that lives in
  -- meeting_quote_snapshots below). Retained indefinitely, same as
  -- category_rollups.
  agenda        jsonb not null default '[]'::jsonb,
  generated_at  timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null
);

create index meetings_tenant_idx on public.meetings (tenant_id, generated_at desc);

-- Evidence quotes backing a meeting's agenda — same purge semantics as
-- sop_evidence_quotes: content_purge_at is copied from the source review,
-- not reset, so a quote leaves the meeting record on the same schedule it
-- would have left the reviews table.
create table public.meeting_quote_snapshots (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null,
  meeting_id        uuid references public.meetings(id) on delete cascade not null,
  review_id         uuid references public.reviews(id) on delete set null,
  location_id       uuid references public.locations(id) on delete set null,
  location_name     text not null,
  category          text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  quote_text        text,              -- nulled at content_purge_at
  star_rating       int,
  reviewed_at       timestamptz,
  content_purge_at  timestamptz not null
);

create index meeting_quote_snapshots_meeting_idx on public.meeting_quote_snapshots (meeting_id);

-- ─────────────────────────────────────────────────────────────────
-- WEEKLY REPORTS
--
-- Manager-triggered ("Generate weekly report" button), no auto-send in
-- v1 — same on-demand pattern as meetings/sops, not a scheduled job.
-- Compares the last 7 days against the prior 7 days by default. The
-- narrative fields (summary, theme descriptions, verdicts, actions) are
-- paraphrased analysis and retained indefinitely, same split as
-- meetings.agenda and sops.content. Verbatim quotes live in
-- report_quote_snapshots below with their own purge clock.
-- ─────────────────────────────────────────────────────────────────

create table public.weekly_reports (
  id                   uuid primary key default uuid_generate_v4(),
  tenant_id            uuid not null,
  period_start         date not null,
  period_end           date not null,
  prior_period_start   date,
  prior_period_end     date,
  has_prior_period     boolean not null default false,
  executive_summary    text not null,
  good_themes          jsonb not null default '[]'::jsonb,
  bad_themes           jsonb not null default '[]'::jsonb,
  location_rankings    jsonb not null default '[]'::jsonb,
  recommended_actions  jsonb not null default '[]'::jsonb,
  -- false when generated by the deterministic fallback (no ANTHROPIC_API_KEY
  -- configured, or the Claude call failed) — the UI surfaces this honestly
  -- rather than pretending a canned report is AI-written.
  ai_generated         boolean not null default true,
  generated_at         timestamptz not null default now(),
  created_by           uuid references public.profiles(id) on delete set null
);

create index weekly_reports_tenant_idx on public.weekly_reports (tenant_id, generated_at desc);

-- Evidence quotes backing a report's good/bad themes — same purge
-- semantics as meeting_quote_snapshots/sop_evidence_quotes:
-- content_purge_at is copied from the source review at insert time, not
-- reset, so a quote leaves the saved report on the same schedule it
-- would have left the reviews table.
create table public.report_quote_snapshots (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null,
  report_id         uuid references public.weekly_reports(id) on delete cascade not null,
  theme_kind        text not null check (theme_kind in ('good','bad')),
  category          text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  review_id         uuid references public.reviews(id) on delete set null,
  location_id       uuid references public.locations(id) on delete set null,
  location_name     text not null,
  quote_text        text,              -- nulled at content_purge_at
  star_rating       int,
  reviewed_at       timestamptz,
  content_purge_at  timestamptz not null
);

create index report_quote_snapshots_report_idx on public.report_quote_snapshots (report_id);

-- ─────────────────────────────────────────────────────────────────
-- WEEKLY DIGEST LOG
-- ─────────────────────────────────────────────────────────────────

create table public.digest_log (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null,
  sent_at     timestamptz not null default now(),
  email_to    text not null,
  status      text not null check (status in ('sent','failed')),
  error_msg   text
);

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.google_tokens     enable row level security;
alter table public.locations         enable row level security;
alter table public.reviews           enable row level security;
alter table public.review_analyses   enable row level security;
alter table public.review_categories enable row level security;
alter table public.category_rollups  enable row level security;
alter table public.drift_alerts      enable row level security;
alter table public.digest_log        enable row level security;
alter table public.sops                    enable row level security;
alter table public.sop_evidence_quotes     enable row level security;
alter table public.meetings                enable row level security;
alter table public.meeting_quote_snapshots enable row level security;
alter table public.weekly_reports          enable row level security;
alter table public.report_quote_snapshots  enable row level security;

-- RLS helper: current tenant from session variable (set by app, never from request params)
create or replace function public.current_tenant_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

-- Profiles: own row
create policy "own profile" on public.profiles for all
  using (auth.uid() = id);

-- All tenant-scoped tables use the same pattern: tenant_id = session variable
create policy "tenant isolation" on public.google_tokens     for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.locations         for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.reviews           for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.review_analyses   for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.review_categories for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.category_rollups  for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.drift_alerts      for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.digest_log        for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.sops                    for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.sop_evidence_quotes     for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.meetings                for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.meeting_quote_snapshots for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.weekly_reports          for all using (tenant_id = public.current_tenant_id());
create policy "tenant isolation" on public.report_quote_snapshots  for all using (tenant_id = public.current_tenant_id());

-- ─────────────────────────────────────────────────────────────────
-- TRIGGERS & AUTO-JOBS
-- ─────────────────────────────────────────────────────────────────

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 30-day text purge job (runs daily at 03:00 UTC)
-- Nulls review_text and reviewer_name when content_purge_at is past.
-- Derived data (category scores, star_rating, dates) is NEVER deleted.
-- Also nulls quote_text in the SOP/Meeting evidence snapshot tables —
-- those quotes carry the source review's own content_purge_at, so they
-- leave saved SOPs/meeting notes on the same 30-day clock as the review
-- they were copied from. The SOP/meeting record itself is untouched.
select cron.schedule(
  'purge-review-text',
  '0 3 * * *',
  $$
    update public.reviews
    set review_text = null, reviewer_name = null
    where content_purge_at <= now()
      and (review_text is not null or reviewer_name is not null);

    update public.sop_evidence_quotes
    set quote_text = null
    where content_purge_at <= now()
      and quote_text is not null;

    update public.meeting_quote_snapshots
    set quote_text = null
    where content_purge_at <= now()
      and quote_text is not null;

    update public.report_quote_snapshots
    set quote_text = null
    where content_purge_at <= now()
      and quote_text is not null;
  $$
);

-- Weekly Monday digest trigger (7:00 UTC — no per-tenant timezone in v1)
-- The actual digest computation + Resend send is handled by the app's
-- API route (POST /api/digest/send) called by this cron job.
select cron.schedule(
  'weekly-digest',
  '0 7 * * 1',
  $$
    select net.http_post(
      url := current_setting('app.base_url') || '/api/digest/send',
      headers := '{"Content-Type":"application/json","x-cron-secret":"' || current_setting('app.cron_secret') || '"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- Reconciliation poll (every 6h — pairs with Pub/Sub push)
-- Ensures missed Pub/Sub events don't silently undercount category mentions.
select cron.schedule(
  'review-reconciliation-poll',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := current_setting('app.base_url') || '/api/reviews/sync',
      headers := '{"Content-Type":"application/json","x-cron-secret":"' || current_setting('app.cron_secret') || '"}'::jsonb,
      body := '{"trigger":"scheduled_poll"}'::jsonb
    );
  $$
);
