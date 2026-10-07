-- Super Admin control center. Everything here is internal: no customer
-- (anon / authenticated) role can read or write any of these tables or run
-- any of these functions. The app reaches them only from server code that
-- has already verified a Super Admin (src/lib/admin/auth.ts) or, for
-- feedback/events, from authenticated API routes that stamp the caller's own
-- tenant server-side.

-- ── Admin roles ─────────────────────────────────────────────────────────
-- Separate from profiles (which customers can read for their team) so an
-- admin grant can never be reached through any customer-writable path.
create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users on delete cascade,
  role        text not null check (role in ('super_admin','support_admin','billing_admin','analytics_admin')),
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  disabled_at timestamptz
);

-- ── Append-only audit log ───────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  actor_user_id uuid,
  actor_email   text,
  action        text not null,
  target_type   text,
  target_id     text,
  tenant_id     uuid,
  details       jsonb not null default '{}'::jsonb,
  ip            text,
  user_agent    text
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_tenant_idx on public.admin_audit_log (tenant_id, created_at desc);

create or replace function public.audit_log_is_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'admin_audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger admin_audit_log_no_update before update or delete on public.admin_audit_log
  for each row execute function public.audit_log_is_append_only();
create trigger admin_audit_log_no_truncate before truncate on public.admin_audit_log
  for each statement execute function public.audit_log_is_append_only();

-- ── Product events (customer usage) ─────────────────────────────────────
create table if not exists public.product_events (
  id                       bigint generated always as identity primary key,
  created_at               timestamptz not null default now(),
  tenant_id                uuid,
  user_id                  uuid,
  location_id              uuid,
  event_type               text not null,
  metadata                 jsonb not null default '{}'::jsonb,
  impersonation_session_id uuid
);
create index if not exists product_events_tenant_idx on public.product_events (tenant_id, created_at desc);
create index if not exists product_events_user_idx on public.product_events (user_id, created_at desc);
create index if not exists product_events_created_idx on public.product_events (created_at desc);
create index if not exists product_events_type_idx on public.product_events (event_type, created_at desc);

-- ── Customer feedback ───────────────────────────────────────────────────
create table if not exists public.feedback (
  id                       uuid primary key default uuid_generate_v4(),
  tenant_id                uuid not null,
  user_id                  uuid references auth.users on delete set null,
  user_email               text,
  location_id              uuid,
  type                     text not null check (type in ('bug','improvement','feature','general','support')),
  subject                  text not null check (char_length(subject) between 1 and 200),
  message                  text not null check (char_length(message) between 1 and 5000),
  rating                   smallint check (rating between 1 and 5),
  status                   text not null default 'new' check (status in ('new','in_review','planned','resolved','closed')),
  priority                 text check (priority in ('low','medium','high','urgent')),
  route                    text,
  context                  jsonb not null default '{}'::jsonb,
  impersonation_session_id uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  resolved_at              timestamptz
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);
create index if not exists feedback_tenant_idx on public.feedback (tenant_id, created_at desc);
create index if not exists feedback_type_idx on public.feedback (type, created_at desc);

create table if not exists public.feedback_notes (
  id             uuid primary key default uuid_generate_v4(),
  feedback_id    uuid not null references public.feedback on delete cascade,
  author_user_id uuid,
  author_email   text,
  note           text not null check (char_length(note) between 1 and 5000),
  created_at     timestamptz not null default now()
);
create index if not exists feedback_notes_feedback_idx on public.feedback_notes (feedback_id, created_at);

-- ── Internal account notes + flags ──────────────────────────────────────
create table if not exists public.account_notes (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null,
  author_user_id uuid,
  author_email   text,
  note           text not null check (char_length(note) between 1 and 5000),
  created_at     timestamptz not null default now()
);
create index if not exists account_notes_tenant_idx on public.account_notes (tenant_id, created_at desc);

-- Internal/test accounts are excluded from customer metrics.
create table if not exists public.tenant_admin_flags (
  tenant_id   uuid primary key,
  is_internal boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- ── Impersonation sessions ──────────────────────────────────────────────
create table if not exists public.impersonation_sessions (
  id               uuid primary key default uuid_generate_v4(),
  admin_user_id    uuid not null,
  admin_email      text,
  target_user_id   uuid not null,
  target_email     text,
  target_tenant_id uuid,
  reason           text not null check (char_length(reason) between 10 and 500),
  auth_session_id  uuid,
  started_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  ended_at         timestamptz,
  end_reason       text,
  ip               text,
  user_agent       text
);
create index if not exists impersonation_sessions_open_idx on public.impersonation_sessions (expires_at) where ended_at is null;
create index if not exists impersonation_sessions_tenant_idx on public.impersonation_sessions (target_tenant_id, started_at desc);

-- ── Application errors (sanitized; no secrets/tokens) ───────────────────
create table if not exists public.app_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  category    text not null,
  source      text not null,
  message     text not null,
  tenant_id   uuid,
  user_id     uuid,
  request_id  text,
  details     jsonb not null default '{}'::jsonb
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
create index if not exists app_errors_category_idx on public.app_errors (category, created_at desc);
create index if not exists app_errors_tenant_idx on public.app_errors (tenant_id, created_at desc);

-- ── Lock every new table away from customer roles ───────────────────────
alter table public.admin_users            enable row level security;
alter table public.admin_audit_log        enable row level security;
alter table public.product_events         enable row level security;
alter table public.feedback               enable row level security;
alter table public.feedback_notes         enable row level security;
alter table public.account_notes          enable row level security;
alter table public.tenant_admin_flags     enable row level security;
alter table public.impersonation_sessions enable row level security;
alter table public.app_errors             enable row level security;
-- (No policies: RLS denies everything to anon/authenticated. Revokes below
-- are a second wall in case a policy is ever added by mistake.)
revoke all on public.admin_users, public.admin_audit_log, public.product_events, public.feedback,
  public.feedback_notes, public.account_notes, public.tenant_admin_flags,
  public.impersonation_sessions, public.app_errors from anon, authenticated;
-- Even the service role can only append to the audit log.
revoke update, delete, truncate on public.admin_audit_log from service_role;

-- ── Signup also records a product event ────────────────────────────────
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

  insert into public.product_events (tenant_id, user_id, event_type, created_at)
  values (v_tenant, new.id, 'signup', new.created_at);
  return new;
end;
$$;

-- ── Admin read models (service role only) ───────────────────────────────
-- One row per restaurant account, aggregated in a single pass — no N+1.
create or replace function public.admin_customer_summaries()
returns table (
  tenant_id uuid, owner_email text, owner_name text, created_at timestamptz,
  member_count int, location_count int, gbp_location_count int, broken_location_count int,
  location_names text[], last_synced_at timestamptz, review_count bigint, analyzed_count bigint,
  trial_started_at timestamptz, trial_ends_at timestamptz, extension_ends_at timestamptz,
  paid boolean, last_sign_in_at timestamptz, last_event_at timestamptz, events_7d bigint,
  open_feedback int, open_bugs int, last_feedback_at timestamptz, is_internal boolean,
  google_connected boolean
)
language sql stable security definer set search_path = public, auth as $$
  with members as (
    select p.tenant_id,
           count(*)::int as member_count,
           min(u.created_at) as created_at,
           max(u.last_sign_in_at) as last_sign_in_at,
           bool_or(p.plan <> 'trial') as paid,
           (array_agg(p.email order by (p.team_role = 'owner') desc, p.created_at))[1] as owner_email,
           (array_agg(p.full_name order by (p.team_role = 'owner') desc, p.created_at))[1] as owner_name
    from profiles p join auth.users u on u.id = p.id
    group by p.tenant_id
  ),
  locs as (
    select l.tenant_id, count(*)::int as location_count,
           count(*) filter (where l.google_location_id like 'locations/%')::int as gbp_location_count,
           count(*) filter (where l.connection_broken)::int as broken_location_count,
           array_agg(l.name order by l.created_at) as location_names,
           max(l.last_synced_at) as last_synced_at
    from locations l group by l.tenant_id
  ),
  revs as (select r.tenant_id, count(*) as review_count from reviews r group by r.tenant_id),
  ana as (select a.tenant_id, count(*) as analyzed_count from review_analyses a group by a.tenant_id),
  ev as (
    select e.tenant_id, max(e.created_at) as last_event_at,
           count(*) filter (where e.created_at > now() - interval '7 days') as events_7d
    from product_events e where e.impersonation_session_id is null group by e.tenant_id
  ),
  fb as (
    select f.tenant_id,
           count(*) filter (where f.status in ('new','in_review'))::int as open_feedback,
           count(*) filter (where f.status in ('new','in_review') and f.type in ('bug','support'))::int as open_bugs,
           max(f.created_at) as last_feedback_at
    from feedback f group by f.tenant_id
  ),
  ext as (select x.tenant_id, max(x.trial_ends_at) as extension_ends_at from trial_extensions x group by x.tenant_id),
  tok as (select distinct g.tenant_id from google_tokens g)
  select m.tenant_id, m.owner_email, m.owner_name, m.created_at,
         m.member_count, coalesce(l.location_count, 0), coalesce(l.gbp_location_count, 0),
         coalesce(l.broken_location_count, 0), coalesce(l.location_names, '{}'), l.last_synced_at,
         coalesce(r.review_count, 0), coalesce(a.analyzed_count, 0),
         t.trial_started_at, t.trial_ends_at, x.extension_ends_at,
         coalesce(m.paid, false), m.last_sign_in_at, e.last_event_at, coalesce(e.events_7d, 0),
         coalesce(f.open_feedback, 0), coalesce(f.open_bugs, 0), f.last_feedback_at,
         coalesce(fl.is_internal, false), (k.tenant_id is not null)
  from members m
  left join locs l on l.tenant_id = m.tenant_id
  left join revs r on r.tenant_id = m.tenant_id
  left join ana a on a.tenant_id = m.tenant_id
  left join ev e on e.tenant_id = m.tenant_id
  left join fb f on f.tenant_id = m.tenant_id
  left join tenant_trials t on t.tenant_id = m.tenant_id
  left join ext x on x.tenant_id = m.tenant_id
  left join tenant_admin_flags fl on fl.tenant_id = m.tenant_id
  left join tok k on k.tenant_id = m.tenant_id;
$$;

-- Paginated, searchable user directory. Never returns password hashes,
-- tokens or any auth secret — only the fields listed here.
create or replace function public.admin_user_directory(
  p_search text default null, p_tenant uuid default null, p_limit int default 50, p_offset int default 0
)
returns table (
  user_id uuid, email text, full_name text, tenant_id uuid, team_role text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz,
  banned_until timestamptz, provider text, admin_role text, total_count bigint
)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, p.full_name, p.tenant_id, p.team_role,
         u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
         coalesce(u.raw_app_meta_data->>'provider', 'email'),
         au.role,
         count(*) over ()
  from auth.users u
  left join profiles p on p.id = u.id
  left join admin_users au on au.user_id = u.id and au.disabled_at is null
  where (p_tenant is null or p.tenant_id = p_tenant)
    and (p_search is null or p_search = ''
         or u.email ilike '%' || p_search || '%'
         or coalesce(p.full_name, '') ilike '%' || p_search || '%')
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

-- Live sessions for login history (device/IP the auth server already keeps).
create or replace function public.admin_user_sessions(p_tenant uuid)
returns table (user_id uuid, email text, created_at timestamptz, refreshed_at timestamp, aal text, ip text, user_agent text)
language sql stable security definer set search_path = public, auth as $$
  select s.user_id, u.email::text, s.created_at, s.refreshed_at, s.aal::text, host(s.ip), s.user_agent
  from auth.sessions s join auth.users u on u.id = s.user_id
  join profiles p on p.id = s.user_id
  where p.tenant_id = p_tenant
  order by s.created_at desc limit 50;
$$;

create or replace function public.admin_revoke_user_sessions(p_user uuid)
returns int language plpgsql security definer set search_path = auth as $$
declare v int;
begin
  delete from auth.sessions where user_id = p_user;
  get diagnostics v = row_count;
  return v;
end;
$$;

create or replace function public.admin_system_health()
returns jsonb language sql stable security definer set search_path = public, cron, net as $$
  select jsonb_build_object(
    'db_time', now(),
    'cron_jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'job', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'last_run', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
        'last_status', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
        'failures_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid
                         and d.status = 'failed' and d.start_time > now() - interval '24 hours')
      ) order by j.jobname), '[]'::jsonb)
      from cron.job j
    ),
    'http_calls_24h', (
      select jsonb_build_object(
        'total', count(*),
        'failed', count(*) filter (where r.status_code is null or r.status_code >= 400 or r.timed_out),
        'timed_out', count(*) filter (where r.timed_out)
      ) from net._http_response r where r.created > now() - interval '24 hours'
    ),
    'pending_analysis', (
      select count(*) from reviews rv where rv.review_text is not null
        and rv.reviewed_at >= now() - interval '90 days'
        and not exists (select 1 from review_analyses a where a.review_id = rv.id)
    ),
    'broken_locations', (select count(*) from locations where connection_broken),
    'stale_locations', (select count(*) from locations where google_location_id like 'locations/%'
                          and (last_synced_at is null or last_synced_at < now() - interval '12 hours')),
    'open_impersonations', (select count(*) from impersonation_sessions where ended_at is null and expires_at > now())
  );
$$;

-- Impersonation sessions are temporary: revoke the auth session the moment
-- one expires, even if the admin just closed the tab.
create or replace function public.end_expired_impersonations()
returns int language plpgsql security definer set search_path = public, auth as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from public.impersonation_sessions where ended_at is null and expires_at <= now() for update loop
    if r.auth_session_id is not null then
      delete from auth.sessions where id = r.auth_session_id;
    end if;
    update public.impersonation_sessions set ended_at = now(), end_reason = 'expired' where id = r.id;
    insert into public.admin_audit_log (actor_user_id, actor_email, action, target_type, target_id, tenant_id, details)
    values (r.admin_user_id, r.admin_email, 'impersonation.expired', 'user', r.target_user_id::text, r.target_tenant_id,
            jsonb_build_object('impersonation_session_id', r.id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- First / additional admins. Run in the Supabase SQL editor as the project
-- owner; no app role can execute it. Marks the admin's own account internal
-- so it doesn't count as a customer.
create or replace function public.grant_admin_role(p_email text, p_role text default 'super_admin')
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid;
  v_tenant uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'No user with email %. Create the login first (Authentication → Users → Add user).', p_email;
  end if;
  insert into public.admin_users (user_id, role) values (v_user, p_role)
    on conflict (user_id) do update set role = excluded.role, disabled_at = null;
  select tenant_id into v_tenant from public.profiles where id = v_user;
  if v_tenant is not null then
    insert into public.tenant_admin_flags (tenant_id, is_internal) values (v_tenant, true)
      on conflict (tenant_id) do update set is_internal = true, updated_at = now();
  end if;
  insert into public.admin_audit_log (action, target_type, target_id, details)
  values ('admin_role.granted', 'user', v_user::text, jsonb_build_object('email', p_email, 'role', p_role, 'via', 'sql'));
  return format('%s is now %s. Sign in at /super-admin/login to set up two-factor authentication.', p_email, p_role);
end;
$$;

revoke all on function public.admin_customer_summaries() from public, anon, authenticated;
revoke all on function public.admin_user_directory(text, uuid, int, int) from public, anon, authenticated;
revoke all on function public.admin_user_sessions(uuid) from public, anon, authenticated;
revoke all on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
revoke all on function public.admin_system_health() from public, anon, authenticated;
revoke all on function public.end_expired_impersonations() from public, anon, authenticated;
revoke all on function public.grant_admin_role(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_customer_summaries() to service_role;
grant execute on function public.admin_user_directory(text, uuid, int, int) to service_role;
grant execute on function public.admin_user_sessions(uuid) to service_role;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;
grant execute on function public.admin_system_health() to service_role;

select cron.schedule('impersonation-expiry', '* * * * *', 'select public.end_expired_impersonations()');
