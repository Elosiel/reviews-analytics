/**
 * POST /api/admin/import-places
 *
 * TEMPORARY — the session-authenticated counterpart to
 * /api/reviews/import-places, used by the /admin/import-places UI. Same
 * bridge, same caveats (see that route's header comment); this one
 * authenticates via the operator's own login instead of x-cron-secret,
 * since a browser page can't hold a shared secret.
 *
 * Delete alongside /admin/import-places once GBP sync is live.
 *
 * Body: { tenant_id, user_id, locations: [{ name, place_id }] }
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { importPlacesForTenant, triggerAnalysis, type PlacesImportLocationInput } from "@/lib/pipeline/places-import";

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const tenantId: string | undefined = body.tenant_id;
  const userId: string | undefined = body.user_id;
  const locations: PlacesImportLocationInput[] = body.locations ?? [];

  if (!tenantId || !userId || locations.length === 0) {
    return NextResponse.json(
      { error: "tenant_id, user_id, and a non-empty locations array are required" },
      { status: 400 }
    );
  }

  // Writes span an arbitrary customer's tenant, not the operator's own —
  // deliberately bypass RLS with the service-role client, now that the
  // caller is confirmed operator above.
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  const results = await importPlacesForTenant(supabase, tenantId, userId, locations, mapsKey);
  triggerAnalysis(process.env.CRON_SECRET);

  const totalInserted = results.reduce((sum, r) => sum + (r.reviews_inserted ?? 0), 0);
  return NextResponse.json({ imported: results.length, reviews_inserted: totalInserted, results });
}
