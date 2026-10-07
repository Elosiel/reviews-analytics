-- Trials. Every restaurant account gets a 30-day trial from the moment it
-- signed up; a specific location can be granted a different end date (e.g.
-- Terra Gaucha Tampa: 6 months). Nothing here is a paywall — it only
-- records, server-side, when each trial ends.
--
-- Rules:
--   * Trial dates are set once and never reset — adding locations, inviting
--     teammates, reconnecting Google or renaming anything doesn't touch them.
--   * Users can read their own account's trial; only the service role (or
--     a migration) can write it.
--   * An extension is keyed by account + Google Business Profile location id,
--     never by display name, and covers only that one location.

-- 1. Account trial (one row per restaurant account / tenant).
create table if not exists public.tenant_trials (
  tenant_id         uuid primary key,
  trial_started_at  timestamptz not null,
  trial_ends_at     timestamptz not null,
  created_at        timestamptz not null default now(),
  check (trial_ends_at > trial_started_at)
);
alter table public.tenant_trials enable row level security;
create policy "team reads own trial" on public.tenant_trials for select
  using (tenant_id = public.auth_tenant_id());
revoke insert, update, delete, truncate on public.tenant_trials from anon, authenticated;

-- 2. Per-location exceptions with an explicit end date.
create table if not exists public.trial_extensions (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null,
  google_location_id  text not null,
  trial_ends_at       timestamptz not null,
  reason              text not null,
  created_at          timestamptz not null default now(),
  unique (tenant_id, google_location_id)
);
alter table public.trial_extensions enable row level security;
create policy "team reads own trial extensions" on public.trial_extensions for select
  using (tenant_id = public.auth_tenant_id());
revoke insert, update, delete, truncate on public.trial_extensions from anon, authenticated;

-- 3. New sign-ups start their 30-day trial at the signup timestamp.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  returning tenant_id into v_tenant;

  insert into public.tenant_trials (tenant_id, trial_started_at, trial_ends_at)
  values (v_tenant, new.created_at, new.created_at + interval '30 days')
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

-- 4. Existing accounts: trial starts at the account's original signup (its
--    earliest member's auth signup).
insert into public.tenant_trials (tenant_id, trial_started_at, trial_ends_at)
select p.tenant_id, min(u.created_at), min(u.created_at) + interval '30 days'
from public.profiles p
join auth.users u on u.id = p.id
group by p.tenant_id
on conflict (tenant_id) do nothing;

-- 5. Terra Gaucha Tampa — 6 calendar months from the account's original
--    signup, for that one Google Business Profile location only. Identified
--    by account id + GBP location id (not by name). Other locations in the
--    same account, and Tampa in any other account, keep the 30-day trial.
insert into public.trial_extensions (tenant_id, google_location_id, trial_ends_at, reason)
select t.tenant_id, 'locations/11387573164314683712', t.trial_started_at + interval '6 months',
       'Terra Gaucha Tampa beta partner: 6 months free from original signup'
from public.tenant_trials t
where t.tenant_id = '91c2934b-5c9d-47e1-8d64-6070f310c77a'
on conflict (tenant_id, google_location_id) do nothing;
