-- Reviews imported / analyzed per location for one account (admin console).
create or replace function public.admin_location_review_counts(p_tenant uuid)
returns table (location_id uuid, reviews bigint, analyzed bigint)
language sql stable security definer set search_path = public as $$
  select r.location_id, count(*), count(a.id)
  from reviews r left join review_analyses a on a.review_id = r.id
  where r.tenant_id = p_tenant
  group by r.location_id;
$$;
revoke all on function public.admin_location_review_counts(uuid) from public, anon, authenticated;
grant execute on function public.admin_location_review_counts(uuid) to service_role;
