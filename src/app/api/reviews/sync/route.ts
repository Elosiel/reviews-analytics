/**
 * POST /api/reviews/sync
 *
 * Pulls reviews from Google Business Profile for active locations.
 * Called by:
 *   1. pg_cron reconciliation poll (every 6h) — body: { trigger: "scheduled_poll" }
 *      Syncs every tenant's locations in one pass — matches pg_cron's own scope.
 *   2. Pub/Sub push webhook — body: { trigger: "pubsub", location_id: "..." }
 *   3. Manual trigger (settings UI, onboarding) — body: { trigger: "manual", location_id?: "..." }
 *      Scoped to the authenticated caller's own locations only.
 *
 * After inserting reviews, triggers /api/reviews/analyze for any unanalyzed reviews.
 * After analysis, triggers /api/rollup/compute to refresh aggregations.
 *
 * 30-day text purge rule: content_purge_at is set by trigger on insert (ingested_at + 30d).
 * Verbatim text is only stored — never re-fetched or extended beyond that date.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMembership } from "@/lib/team/membership";
import { getValidAccessToken } from "@/lib/pipeline/tokens";
import { listReviews } from "@/lib/google/business-profile";
import { PLACES_IMPORT_SENTINEL } from "@/lib/google/places-reviews";
import { describeGoogleError, type GoogleErrorKind } from "@/lib/google/errors";
import { importCutoffMs, selectWindowReviews } from "@/lib/reviews/import-window";

// The onboarding first import pages through the import window synchronously.
export const maxDuration = 60;

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

  // Anything but the cron poll is a signed-in user's request, and is scoped
  // to that user's own restaurant account (any teammate may trigger it).
  let callerTenantId: string | null = null;
  if (trigger !== "scheduled_poll") {
    const me = await getMembership(await createClient());
    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    callerTenantId = me.tenantId;
  }

  // scheduled_poll syncs across every tenant's locations in one pass,
  // matching pg_cron's own scope. Every other trigger is scoped to the
  // caller's tenant — it must never sync (or surface errors or location
  // names from) another tenant's data.
  const supabase = createServiceClient();

  let locationsQuery = supabase
    .from("locations")
    .select("id, tenant_id, user_id, google_account_id, google_location_id, name")
    .eq("connection_broken", false)
    // Rows seeded by the temporary Places-API bridge (see
    // lib/google/places-reviews.ts) carry a Place ID, not a real GBP
    // location resource name — sending one through the real Business
    // Profile reviews endpoint 404s every time. This path is for real
    // OAuth-connected locations only.
    .neq("google_account_id", PLACES_IMPORT_SENTINEL);

  if (callerTenantId) {
    locationsQuery = locationsQuery.eq("tenant_id", callerTenantId);
  }

  if (body.location_id) {
    locationsQuery = locationsQuery.eq("id", body.location_id);
  }

  const { data: locations, error: locErr } = await locationsQuery;

  if (locErr || !locations?.length) {
    // no_locations: nothing syncable (none saved, or all marked broken) —
    // onboarding must not read this as "connected, zero reviews".
    return NextResponse.json(
      { message: "No locations to sync", synced: 0, inserted: 0, results: [], no_locations: true },
      { status: 200 }
    );
  }

  const results: {
    location_id: string;
    location_name: string;
    inserted: number;
    // Google's own figures for the listing, from the reviews.list response.
    average_rating?: number | null;
    total_review_count?: number | null;
    error?: string;
    error_kind?: GoogleErrorKind;
  }[] = [];

  for (const loc of locations) {
    try {
      const accessToken = await getValidAccessToken(supabase, loc.user_id);

      let pageToken: string | undefined;
      let locationInserted = 0;
      let averageRating: number | null = null;
      let totalReviewCount: number | null = null;

      // Page newest-updated first and stop at the import window.
      const cutoffMs = importCutoffMs();
      do {
        const data = await withBackoff(() =>
          listReviews(accessToken, loc.google_account_id, loc.google_location_id, pageToken)
        );

        // Every page repeats the listing-level stats; a listing with no
        // reviews omits them, which genuinely means zero reviews.
        if (typeof data.averageRating === "number") averageRating = data.averageRating;
        totalReviewCount = typeof data.totalReviewCount === "number" ? data.totalReviewCount : 0;

        const reviews: {
          reviewId: string;
          starRating: string;
          comment?: string;
          reviewer?: { displayName?: string };
          createTime: string;
          updateTime?: string;
        }[] = data.reviews ?? [];

        pageToken = data.nextPageToken;

        if (reviews.length === 0) break;

        const { keep, reachedCutoff } = selectWindowReviews(reviews, cutoffMs);
        if (reachedCutoff) pageToken = undefined;
        if (keep.length === 0) continue;

        // Map star rating string → int
        const STAR_MAP: Record<string, number> = {
          ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
        };

        const rows = keep.map((r) => ({
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

      await supabase
        .from("locations")
        .update({
          last_synced_at: new Date().toISOString(),
          rating: averageRating,
          review_count: totalReviewCount ?? 0,
        })
        .eq("id", loc.id);

      results.push({
        location_id: loc.id,
        location_name: loc.name,
        inserted: locationInserted,
        average_rating: averageRating,
        total_review_count: totalReviewCount ?? 0,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Sync failed for location ${loc.id}:`, msg);
      const info = describeGoogleError(err);
      results.push({
        location_id: loc.id,
        location_name: loc.name,
        inserted: 0,
        error: info.message,
        error_kind: info.kind,
      });
    }
  }

  // Trigger analysis for any reviews that haven't been analyzed yet.
  // Runs via after() — a plain un-awaited fetch() gets cut off when the
  // serverless function tears down right after the response is sent.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  after(() =>
    fetch(`${appUrl}/api/reviews/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": CRON_SECRET ?? "",
      },
      body: JSON.stringify({ trigger: "post_sync" }),
    }).catch((e) => console.error("Failed to trigger analysis:", e))
  );

  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  return NextResponse.json({
    synced: results.length,
    inserted: totalInserted,
    results,
  });
}
