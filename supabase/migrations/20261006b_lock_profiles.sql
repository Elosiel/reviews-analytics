-- Security: the old "own profile" policy was FOR ALL with no column limits,
-- so a signed-in user could UPDATE their own tenant_id (another restaurant's
-- data), role (operator = admin) or team_role. After this, users can only
-- READ profiles (own + teammates, via "read own team" from 20261006); every
-- write goes through the service role or a security-definer function.
-- Run after 20261006_team_invites.sql.
drop policy if exists "own profile" on public.profiles;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke insert, update, delete, truncate on public.team_invites from anon, authenticated;
revoke all on function public.accept_team_invite(text) from public, anon;
