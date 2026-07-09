/**
 * TEMPORARY bridge — shared by both entry points that seed review data via
 * the Places API while GBP read access is pending (CLAUDE.md "Critical-Path
 * Gates" #1): the x-cron-secret route (src/app/api/reviews/import-places)
 * and the operator-only UI (src/app/api/admin/import-places).
 *
 * Delete alongside those two routes, src/app/admin/import-places, and
 * src/lib/google/places-reviews.ts once GBP sync is live for real tenants.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { fetchPlaceReviews, PLACES_IMPORT_SENTINEL } from "@/lib/google/places-reviews";

export interface PlacesImportLocationInput {
  name: string;
  place_id: string;
}

export interface PlacesImportResult {
  place_id: string;
  name: string;
  location_id?: string;
  reviews_inserted?: number;
  error?: string;
}

export async function importPlacesForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  locations: PlacesImportLocationInput[],
  mapsKey: string
): Promise<PlacesImportResult[]> {
  const results: PlacesImportResult[] = [];

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

  return results;
}

// Fires the same post-ingest chain the real GBP sync uses — analyze, which
// itself triggers rollup/compute. Runs via after(): must be called during
// an active route handler's execution (which every caller of this function
// satisfies) — a plain un-awaited fetch() gets cut off when the serverless
// function tears down right after the response is sent.
export function triggerAnalysis(cronSecret: string | undefined) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  after(() =>
    fetch(`${appUrl}/api/reviews/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": cronSecret ?? "" },
      body: JSON.stringify({ trigger: "post_sync" }),
    }).catch((e) => console.error("Failed to trigger analysis:", e))
  );
}
