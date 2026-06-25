-- Reviews Analytics — Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Users (extends Supabase auth.users) ──────────────────────────
create table public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text not null,
  full_name     text,
  avatar_url    text,
  plan          text not null default 'trial', -- trial | standard | enterprise
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Google OAuth tokens (per user) ───────────────────────────────
create table public.google_tokens (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    bigint not null,
  scope         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(user_id)
);

-- ── Locations ─────────────────────────────────────────────────────
create table public.locations (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid references public.profiles(id) on delete cascade not null,
  google_account_id    text not null,
  google_location_id   text not null,
  name                 text not null,
  address              text,
  rating               numeric(3,2),
  review_count         int default 0,
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique(user_id, google_location_id)
);

-- ── Reviews ───────────────────────────────────────────────────────
create table public.reviews (
  id                  uuid primary key default uuid_generate_v4(),
  location_id         uuid references public.locations(id) on delete cascade not null,
  google_review_id    text not null unique,
  author_name         text,
  rating              int not null check (rating between 1 and 5),
  text                text,
  published_at        timestamptz not null,
  sentiment_score     numeric(4,3), -- -1.000 to 1.000
  created_at          timestamptz not null default now()
);

-- ── Review categories (sentiment per category) ────────────────────
create table public.review_categories (
  id          uuid primary key default uuid_generate_v4(),
  review_id   uuid references public.reviews(id) on delete cascade not null,
  category    text not null check (category in ('food','service','atmosphere','value','wait_time','cleanliness')),
  sentiment   text not null check (sentiment in ('positive','neutral','negative')),
  score       numeric(4,3),
  excerpt     text
);

-- ── Drift alerts ──────────────────────────────────────────────────
create table public.drift_alerts (
  id           uuid primary key default uuid_generate_v4(),
  location_id  uuid references public.locations(id) on delete cascade not null,
  category     text not null,
  severity     text not null check (severity in ('low','medium','high')),
  message      text not null,
  detected_at  timestamptz not null default now(),
  resolved     boolean not null default false,
  resolved_at  timestamptz
);

-- ── Row Level Security ────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.google_tokens   enable row level security;
alter table public.locations       enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_categories enable row level security;
alter table public.drift_alerts    enable row level security;

-- Profiles: own row only
create policy "users can read own profile"  on public.profiles for select using (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Google tokens: own row only
create policy "users can manage own tokens" on public.google_tokens for all using (auth.uid() = user_id);

-- Locations: own locations only
create policy "users can manage own locations" on public.locations for all using (auth.uid() = user_id);

-- Reviews: via location ownership
create policy "users can read own reviews" on public.reviews for select
  using (exists (select 1 from public.locations l where l.id = reviews.location_id and l.user_id = auth.uid()));

-- Review categories: via review → location ownership
create policy "users can read own review categories" on public.review_categories for select
  using (exists (
    select 1 from public.reviews r
    join public.locations l on l.id = r.location_id
    where r.id = review_categories.review_id and l.user_id = auth.uid()
  ));

-- Drift alerts: via location ownership
create policy "users can read own drift alerts" on public.drift_alerts for select
  using (exists (select 1 from public.locations l where l.id = drift_alerts.location_id and l.user_id = auth.uid()));

-- ── Trigger: create profile on signup ────────────────────────────
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
