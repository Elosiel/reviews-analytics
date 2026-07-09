/**
 * Google Places API review fetcher — TEMPORARY bridge until Google Business
 * Profile API read access is approved (see CLAUDE.md "Critical-Path Gates").
 *
 * This is the same official, already-approved Places API used by the public
 * /preview teaser (src/app/api/places/details/route.ts) — not a scraper.
 * Trade-off: Places only exposes up to ~5 reviews per location (vs GBP's
 * full history), so this seeds a demo/design-partner account with real
 * data but is not a substitute for the GBP sync once approved.
 *
 * Delete this file (and src/app/api/reviews/import-places/route.ts) once
 * /api/reviews/sync is pulling from Business Profile for real tenants.
 */

import { createHash } from "crypto";

// Sentinel written to locations.google_account_id for rows created by this
// bridge, so they're easy to find and delete once GBP sync takes over:
//   delete from locations where google_account_id = 'places-api-temp';
// (cascades to reviews, review_analyses, review_categories, category_rollups)
export const PLACES_IMPORT_SENTINEL = "places-api-temp";

export interface PlaceReviewRow {
  external_review_id: string;
  star_rating: number;
  review_text: string | null;
  reviewer_name: string | null;
  reviewed_at: string; // ISO
}

export interface PlaceImportResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  review_count: number;
  reviews: PlaceReviewRow[];
}

type NewPlaceReview = {
  authorAttribution?: { displayName?: string };
  rating?: number;
  text?: { text?: string };
  publishTime?: string;
};

type LegacyPlaceReview = {
  author_name?: string;
  rating?: number;
  text?: string;
  time?: number; // unix seconds
};

// Stable id: Places API gives no persistent review id, so hash the
// content that identifies a single review. Reruns upsert cleanly instead
// of duplicating; prefixed so it can never collide with a future GBP id.
function syntheticReviewId(placeId: string, author: string, text: string, time: string) {
  const hash = createHash("sha1").update(`${author}|${text}|${time}`).digest("hex").slice(0, 16);
  return `places_${placeId}_${hash}`;
}

export async function fetchPlaceReviews(placeId: string, apiKey: string): Promise<PlaceImportResult> {
  const [newRes, legacyRes] = await Promise.all([
    fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,rating,userRatingCount,reviews",
      },
    }),
    fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&reviews_sort=newest&key=${apiKey}`
    ).catch(() => null),
  ]);

  if (!newRes.ok) {
    throw new Error(`Places API error ${newRes.status}: ${await newRes.text()}`);
  }

  const p = await newRes.json();

  let rows: PlaceReviewRow[] = [];

  if (legacyRes?.ok) {
    try {
      const legacy = await legacyRes.json();
      if (legacy.status === "OK" && Array.isArray(legacy.result?.reviews)) {
        rows = (legacy.result.reviews as LegacyPlaceReview[])
          .slice()
          .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
          .map((r) => {
            const reviewedAt = new Date((r.time ?? 0) * 1000).toISOString();
            const author = r.author_name ?? "A Google user";
            const text = r.text ?? "";
            return {
              external_review_id: syntheticReviewId(placeId, author, text, reviewedAt),
              star_rating: r.rating ?? 3,
              review_text: text || null,
              reviewer_name: author,
              reviewed_at: reviewedAt,
            };
          });
      }
    } catch {
      // fall through to the new API's reviews
    }
  }

  if (rows.length === 0) {
    rows = ((p.reviews ?? []) as NewPlaceReview[])
      .slice()
      .sort(
        (a, b) => (Date.parse(b.publishTime ?? "") || 0) - (Date.parse(a.publishTime ?? "") || 0)
      )
      .map((r) => {
        const reviewedAt = r.publishTime ?? new Date().toISOString();
        const author = r.authorAttribution?.displayName ?? "A Google user";
        const text = r.text?.text ?? "";
        return {
          external_review_id: syntheticReviewId(placeId, author, text, reviewedAt),
          star_rating: r.rating ?? 3,
          review_text: text || null,
          reviewer_name: author,
          reviewed_at: reviewedAt,
        };
      });
  }

  return {
    place_id: placeId,
    name: (p.displayName?.text as string) ?? "Unknown",
    address: (p.formattedAddress as string) ?? "",
    rating: (p.rating as number) ?? null,
    review_count: (p.userRatingCount as number) ?? 0,
    reviews: rows,
  };
}
