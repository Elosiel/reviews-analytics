/**
 * POST /api/reviews/sync
 *
 * Pulls reviews from Google Business Profile for all active locations.
 * Called by:
 *   1. pg_cron reconciliation poll (every 6h) — body: { trigger: "scheduled_poll" }
 *   2. Pub/Sub push webhook — body: { trigger: "pubsub", location_id: "..." }
 *   3. Manual trigger from settings UI — body: { trigger: "manual", location_id?: "..." }
 *
 * After inserting reviews, triggers /api/reviews/analyze for any unanalyzed reviews.
 * After analysis, triggers /api/rollup/compute to refresh aggregations.
 *
 * 30-day text purge rule: content_purge_at is set by trigger on insert (ingested_at + 30d).
 * Verbatim text is only stored — never re-fetched or extended beyond that date.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/pipeline/tokens";
import { listReviews } from "@/lib/google/business-profile";

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
}

// Exponential backoff helper for rate limit (429) handling
async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error && err.message.includes("429");
      if (!isRateLimit || attempt === maxRetries - 1) throw err;
      // Exponential backoff with jitter
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function POST(request: Request) {
  // Validate — only cron jobs or authenticated users can trigger this
  const body = await request.json().catch(() => ({}));
  const trigger = body.trigger ?? "manual";

  if (trigger === "scheduled_poll" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // For manual/pubsub: verify the user is authenticated
  if (trigger !== "scheduled_poll") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Determine which locations to sync
  let locationsQuery = supabase
    .from("locations")
    .select("id, tenant_id, user_id, google_account_id, google_location_id, name")
    .eq("connection_broken", false);

  if (body.location_id) {
    locationsQuery = locationsQuery.eq("id", body.location_id);
  }

  const { data: locations, error: locErr } = await locationsQuery;

  if (locErr || !locations?.length) {
    return NextResponse.json(
      { message: "No locations to sync", synced: 0 },
      { status: 200 }
    );
  }

  const results: { location_id: string; inserted: number; error?: string }[] = [];

  for (const loc of locations) {
    try {
      const accessToken = await getValidAccessToken(supabase, loc.user_id);

      let pageToken: string | undefined;
      let locationInserted = 0;

      // Paginate through all reviews for this location
      do {
        const data = await withBackoff(() =>
          listReviews(accessToken, loc.google_account_id, loc.google_location_id, pageToken)
        );

        const reviews: {
          reviewId: string;
          starRating: string;
          comment?: string;
          reviewer?: { displayName?: string };
          createTime: string;
        }[] = data.reviews ?? [];

        pageToken = data.nextPageToken;

        if (reviews.length === 0) break;

        // Map star rating string → int
        const STAR_MAP: Record<string, number> = {
          ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
        };

        const rows = reviews.map((r) => ({
          tenant_id: loc.tenant_id,
          location_id: loc.id,
          external_review_id: r.reviewId,
          source: "google",
          star_rating: STAR_MAP[r.starRating] ?? 3,
          review_text: r.comment ?? null,
          reviewer_name: r.reviewer?.displayName ?? null,
          reviewed_at: r.createTime,
          // content_purge_at is set by DB trigger (ingested_at + 30 days)
          status: "ingested",
        }));

        // Upsert — skip duplicates, don't overwrite existing verbatim text
        const { error: insertErr } = await supabase
          .from("reviews")
          .upsert(rows, {
            onConflict: "tenant_id,external_review_id",
            ignoreDuplicates: true,
          });

        if (insertErr) throw new Error(insertErr.message);
        locationInserted += rows.length;

      } while (pageToken);

      // Update last_synced_at
      await supabase
        .from("locations")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", loc.id);

      results.push({ location_id: loc.id, inserted: locationInserted });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Sync failed for location ${loc.id}:`, msg);
      results.push({ location_id: loc.id, inserted: 0, error: msg });
    }
  }

  // Trigger analysis for any reviews that haven't been analyzed yet
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  fetch(`${appUrl}/api/reviews/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": CRON_SECRET ?? "",
    },
    body: JSON.stringify({ trigger: "post_sync" }),
  }).catch((e) => console.error("Failed to trigger analysis:", e));

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  return NextResponse.json({
    synced: results.length,
    inserted: totalInserted,
    results,
  });
}
