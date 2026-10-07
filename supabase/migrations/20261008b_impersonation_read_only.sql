-- Impersonation is read-only at the database level, not just in the app:
-- a session that a Super Admin opened with "Login as user" cannot insert,
-- update or delete customer data, even through the browser Supabase client.
-- The session is recognized by its auth session id (JWT claim session_id),
-- recorded in impersonation_sessions when the session was created.

create index if not exists impersonation_sessions_auth_session_idx
  on public.impersonation_sessions (auth_session_id) where ended_at is null;

create or replace function public.is_impersonating()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.impersonation_sessions s
    where s.ended_at is null
      and s.auth_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
  );
$$;
grant execute on function public.is_impersonating() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'tenant_profiles','tenant_documents','locations','google_tokens','sops','sop_evidence_quotes',
    'meetings','meeting_quote_snapshots','weekly_reports','report_quote_snapshots','drift_alerts','team_invites'
  ] loop
    execute format('create policy "no writes while impersonating (insert)" on public.%I as restrictive for insert to authenticated with check (not public.is_impersonating())', t);
    execute format('create policy "no writes while impersonating (update)" on public.%I as restrictive for update to authenticated using (not public.is_impersonating())', t);
    execute format('create policy "no writes while impersonating (delete)" on public.%I as restrictive for delete to authenticated using (not public.is_impersonating())', t);
  end loop;
end $$;

create policy "no uploads while impersonating" on storage.objects as restrictive for insert to authenticated
  with check (not public.is_impersonating());
create policy "no storage edits while impersonating" on storage.objects as restrictive for update to authenticated
  using (not public.is_impersonating());
create policy "no storage deletes while impersonating" on storage.objects as restrictive for delete to authenticated
  using (not public.is_impersonating());
