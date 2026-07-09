/**
 * POST /api/reviews/import-places
 *
 * TEMPORARY bridge — seeds real review data via the Google Places API
 * while Google Business Profile read access is pending approval
 * (CLAUDE.md "Critical-Path Gates" #1). Internal/admin use only: run this
 * once per design-partner signup to backfill their locations, not called
 * from any tenant-facing UI.
 *
 * Delete this route + src/lib/google/places-reviews.ts once
 * /api/reviews/sync (GBP) is live for real tenants. Rows it writes are
 * tagged so they're easy to find and remove:
 *   delete from locations where google_account_id = 'places-api-temp';
 *
 * Auth: same shared-secret pattern as the other pipeline routes
 * (x-cron-secret) — this is an ops tool, not a public endpoint.
 *
 * Body:
 *   {
 *     "tenant_id": "uuid",
 *     "user_id": "uuid",              // profiles.id that owns these locations
 *     "locations": [
 *       { "name": "Trattoria Downtown", "place_id": "ChIJ..." },
 *       ...                            // one call handles any number of restaurants
 *     ]
 *   }
 *
 * Find place_id values with GET /api/places/search?q=<restaurant name + city>.
 *
 * Caveat: Places API returns at most ~5 reviews per location (vs GBP's
 * full history) — enough to demo and exercise the pipeline, not a
 * complete review history.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { fetchPlaceReviews, PLACES_IMPORT_SENTINEL } from "@/lib/google/places-reviews";

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
}

interface LocationInput {
  name: string;
  place_id: string;
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!mapsKey || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_URL" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const tenantId: string | undefined = body.tenant_id;
  const userId: string | undefined = body.user_id;
  const locations: LocationInput[] = body.locations ?? [];

  if (!tenantId || !userId || locations.length === 0) {
    return NextResponse.json(
      { error: "tenant_id, user_id, and a non-empty locations array are required" },
      { status: 400 }
    );
  }

  // Service-role client — this route runs with no logged-in session, so it
  // must bypass RLS deliberately (never expose this key to the client).
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  const results: {
    place_id: string;
    name: string;
    location_id?: string;
    reviews_inserted?: number;
    error?: string;
  }[] = [];

  for (const input of locations) {
    try {
      const place = await fetchPlaceReviews(input.place_id, mapsKey);
      const name = input.name || place.name;

      const { data: locRow, error: locErr } = await supabase
        .from("locations")
        .upsert(
          {
            tenant_id: tenantId,
            user_id: userId,
            google_account_id: PLACES_IMPORT_SENTINEL,
            google_location_id: input.place_id,
            name,
            address: place.address,
            rating: place.rating,
            review_count: place.review_count,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,google_location_id" }
        )
        .select("id")
        .single();

      if (locErr || !locRow) throw new Error(locErr?.message ?? "Failed to upsert location");

      const rows = place.reviews.map((r) => ({
        tenant_id: tenantId,
        location_id: locRow.id,
        external_review_id: r.external_review_id,
        source: "google_places_temp",
        star_rating: r.star_rating,
        review_text: r.review_text,
        reviewer_name: r.reviewer_name,
        reviewed_at: r.reviewed_at,
        status: "ingested",
      }));

      if (rows.length > 0) {
        const { error: insertErr } = await supabase
          .from("reviews")
          .upsert(rows, { onConflict: "tenant_id,external_review_id", ignoreDuplicates: true });

        if (insertErr) throw new Error(insertErr.message);
      }

      results.push({ place_id: input.place_id, name, location_id: locRow.id, reviews_inserted: rows.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Places import failed for ${input.place_id}:`, msg);
      results.push({ place_id: input.place_id, name: input.name, error: msg });
    }
  }

  // Same downstream chain as the real sync: analyze → rollup.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  fetch(`${appUrl}/api/reviews/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET ?? "" },
    body: JSON.stringify({ trigger: "post_sync" }),
  }).catch((e) => console.error("Failed to trigger analysis:", e));

  const totalInserted = results.reduce((sum, r) => sum + (r.reviews_inserted ?? 0), 0);
  return NextResponse.json({ imported: results.length, reviews_inserted: totalInserted, results });
}
