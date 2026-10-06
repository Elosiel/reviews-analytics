-- Danger alerts in weekly reports show who wrote the review. The name is
-- verbatim Google content, so it's purged with the quote at content_purge_at.
alter table public.report_quote_snapshots add column if not exists reviewer_name text;

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
    set quote_text = null, reviewer_name = null
    where content_purge_at <= now()
      and (quote_text is not null or reviewer_name is not null);
  $$
);
