-- profiles is read-only to customers. The "own profile" ALL policy from the
-- original schema let a signed-in user update their own row — including
-- role ('operator') and tenant_id (another restaurant's data). The planned
-- lock-down (20261006b) needs DROP POLICY, which couldn't be run from the
-- tooling; this trigger closes the hole additively and stays as a second
-- wall after 20261006b runs. Security-definer functions (signup trigger,
-- accept_team_invite) and the service role run as other roles and are
-- unaffected.
create or replace function public.profiles_write_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'profiles are read-only to users' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_write_guard
  before insert or update or delete on public.profiles
  for each row execute function public.profiles_write_guard();
