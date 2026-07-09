/**
 * POST /api/reviews/import-places
 *
 * TEMPORARY bridge — seeds real review data via the Google Places API
 * while Google Business Profile read access is pending approval
 * (CLAUDE.md "Critical-Path Gates" #1). Internal/admin use only: run this
 * once per design-partner signup to backfill their locations, not called
 * from any tenant-facing UI. For the point-and-click version of this,
 * see /admin/import-places.
 *
 * Delete this route + src/lib/google/places-reviews.ts +
 * src/lib/pipeline/places-import.ts once /api/reviews/sync (GBP) is live
 * for real tenants. Rows it writes are tagged so they're easy to find and
 * remove:
 *   delete from locations where google_account_id = 'places-api-temp';
 *
 * Auth: same shared-secret pattern as the other pipeline routes
 * (x-cron-secret) — for scripted/curl use. The browser UI at
 * /admin/import-places calls /api/admin/import-places instead, which
 * authenticates via the operator's session.
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
import { importPlacesForTenant, triggerAnalysis, type PlacesImportLocationInput } from "@/lib/pipeline/places-import";

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
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
  const locations: PlacesImportLocationInput[] = body.locations ?? [];

  if (!tenantId || !userId || locations.length === 0) {
    return NextResponse.json(
      { error: "tenant_id, user_id, and a non-empty locations array are required" },
      { status: 400 }
    );
  }

  // Service-role client — this route runs with no logged-in session, so it
  // must bypass RLS deliberately (never expose this key to the client).
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  const results = await importPlacesForTenant(supabase, tenantId, userId, locations, mapsKey);
  triggerAnalysis(CRON_SECRET);

  const totalInserted = results.reduce((sum, r) => sum + (r.reviews_inserted ?? 0), 0);
  return NextResponse.json({ imported: results.length, reviews_inserted: totalInserted, results });
}
