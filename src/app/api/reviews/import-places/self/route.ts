/**
 * POST /api/reviews/import-places/self
 *
 * TEMPORARY — self-service counterpart to /api/admin/import-places, used
 * by the in-dashboard search tool (src/components/dashboard/ImportReviewsSearch.tsx)
 * so any signed-in tenant can pull their own real reviews via the Google
 * Places API while GBP read access is pending (CLAUDE.md "Critical-Path
 * Gates" #1). See src/app/api/reviews/import-places/route.ts for the full
 * bridge explanation and caveats — same limits (~5 reviews/location) apply.
 *
 * Safety: tenant_id/user_id are ALWAYS resolved from the caller's own
 * session, never accepted from the request body — this can only ever
 * write into the signed-in user's own tenant.
 *
 * Delete alongside the rest of the bridge once GBP sync is live.
 *
 * Body: { locations: [{ name, place_id }] }
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { importPlacesForTenant, triggerAnalysis, type PlacesImportLocationInput } from "@/lib/pipeline/places-import";

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sessionClient
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!mapsKey || !serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const locations: PlacesImportLocationInput[] = body.locations ?? [];

  if (locations.length === 0) {
    return NextResponse.json({ error: "A non-empty locations array is required" }, { status: 400 });
  }

  // Writing to a tenant needs to bypass "own profile"-only RLS — safe here
  // because tenant_id/user_id above came from the verified session, not
  // from the request body.
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  const results = await importPlacesForTenant(supabase, profile.tenant_id, user.id, locations, mapsKey);
  triggerAnalysis(process.env.CRON_SECRET);

  const totalInserted = results.reduce((sum, r) => sum + (r.reviews_inserted ?? 0), 0);
  return NextResponse.json({ imported: results.length, reviews_inserted: totalInserted, results });
}
