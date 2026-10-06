-- Analysis only works through reviews written in the last 90 days (the
-- import window), and a catch-up job keeps it moving.

-- 1. The analysis queue: unanalyzed reviews with text since p_since, newest
--    first. One query instead of pulling every analyzed id over the API.
create or replace function public.pending_analysis_reviews(p_since timestamptz, p_limit int)
returns table (id uuid, tenant_id uuid, location_id uuid, star_rating int, review_text text)
language sql stable security invoker set search_path = public as $$
  select r.id, r.tenant_id, r.location_id, r.star_rating, r.review_text
  from public.reviews r
  where r.review_text is not null and r.reviewed_at >= p_since
    and not exists (select 1 from public.review_analyses a where a.review_id = r.id)
  order by r.reviewed_at desc
  limit p_limit;
$$;

-- 2. Catch-up every 5 minutes. Vercel stops an app calling itself after a
--    few hops, so a long backlog can't rely on the self-chain alone. The
--    route returns at once and steps aside if a run is already going.
--    Built from the reconciliation poll's own command, so it calls the same
--    app with the same secret without the secret appearing here.
select cron.schedule(
  'analysis-catch-up',
  '*/5 * * * *',
  replace(
    replace(
      (select command from cron.job where jobname = 'review-reconciliation-poll'),
      '/api/reviews/sync', '/api/reviews/analyze'
    ),
    'scheduled_poll', 'scheduled_catchup'
  )
);
