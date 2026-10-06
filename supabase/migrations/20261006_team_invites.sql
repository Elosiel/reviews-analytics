-- Additive only — safe to apply while older code is live. The security
-- lock-down of profiles is in 20261006b_lock_profiles.sql.

-- 1. Teammate reads.
-- Teammates (same tenant) can read each other's profiles. Added alongside
-- the old "own profile" policy; 20261006b removes that one.
create policy "read own team" on public.profiles for select
  using (id = auth.uid() or tenant_id = public.auth_tenant_id());

-- 2. Team roles. Everyone who exists today owns their own restaurant account.
alter table public.profiles
  add column if not exists team_role text not null default 'owner'
  check (team_role in ('owner', 'member'));

create or replace function public.auth_team_role()
returns text language sql stable security definer set search_path = public as $$
  select team_role from public.profiles where id = auth.uid();
$$;

-- Only owners add or remove locations. Restrictive policies AND with the
-- existing tenant-isolation policy; no auth.uid() (service role / cron)
-- is unaffected.
create policy "owners insert locations" on public.locations as restrictive for insert
  with check (auth.uid() is null or public.auth_team_role() = 'owner');
create policy "owners delete locations" on public.locations as restrictive for delete
  using (auth.uid() is null or public.auth_team_role() = 'owner');

-- 3. Invitations. Only a SHA-256 hash of the link token is stored.
create table if not exists public.team_invites (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null,
  email        text not null,
  token_hash   text not null unique,
  invited_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null
);
create index if not exists team_invites_tenant_idx on public.team_invites (tenant_id);
create unique index if not exists team_invites_one_pending_per_email
  on public.team_invites (tenant_id, lower(email)) where accepted_at is null;

alter table public.team_invites enable row level security;
create policy "team reads invites" on public.team_invites for select
  using (tenant_id = public.auth_tenant_id());

-- 4. Accepting an invite moves the caller (and only the caller) into the
--    inviting restaurant account, if the link is valid, unexpired, unused,
--    issued to the caller's own confirmed email, and the caller's current
--    account has no data of its own to orphan.
create or replace function public.accept_team_invite(p_token_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_confirmed  timestamptz;
  v_inv        public.team_invites%rowtype;
  v_old_tenant uuid;
begin
  if v_uid is null then return 'not_signed_in'; end if;

  select * into v_inv from public.team_invites where token_hash = p_token_hash for update;
  if not found then return 'invalid'; end if;
  if v_inv.accepted_at is not null then
    return case when v_inv.accepted_by = v_uid then 'already_member' else 'used' end;
  end if;
  if v_inv.expires_at < now() then return 'expired'; end if;

  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_email is distinct from lower(v_inv.email) then return 'wrong_email'; end if;
  if v_confirmed is null then return 'email_unconfirmed'; end if;

  select tenant_id into v_old_tenant from public.profiles where id = v_uid for update;
  if v_old_tenant <> v_inv.tenant_id then
    if exists (select 1 from public.locations where tenant_id = v_old_tenant)
       or exists (select 1 from public.profiles where tenant_id = v_old_tenant and id <> v_uid) then
      return 'has_own_account';
    end if;
    update public.profiles
      set tenant_id = v_inv.tenant_id, team_role = 'member', updated_at = now()
      where id = v_uid;
  end if;

  update public.team_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return 'joined';
end;
$$;
grant execute on function public.accept_team_invite(text) to authenticated;
