/**
 * Builds the one-page public-reviews preview report for any Google place.
 *
 * Reuses the existing pieces — no new data source, no GBP OAuth:
 *  - fetchPlaceReviews() (src/lib/google/places-reviews.ts): official
 *    Places API; Google returns at most ~5 public reviews per place.
 *  - analyzeReview() (src/lib/pipeline/claude.ts): the same fixed
 *    6-category classifier the paid product uses.
 *  - summarizePreviewReport(): one extra Claude call for the top fixes.
 *
 * Cached 24h per place_id in the Next data cache (shared across instances
 * on Vercel), so repeat views cost no Places/Claude calls.
 */

import { unstable_cache } from "next/cache";
import { fetchPlaceReviews } from "@/lib/google/places-reviews";
import { analyzeReview, summarizePreviewReport } from "@/lib/pipeline/claude";
import {
  aggregateRisks,
  aggregateThemes,
  type ClassifiedReview,
  type PreviewRisk,
  type PreviewTheme,
} from "@/lib/preview-report/aggregate";

export interface PreviewReport {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  total_reviews: number;
  reviews_analyzed: number;
  oldest_review_at: string | null;
  newest_review_at: string | null;
  themes: PreviewTheme[];
  top_fixes: { title: string; detail: string; category: string }[];
  strengths: { title: string; detail: string; category: string }[];
  risks: PreviewRisk[];
  generated_at: string;
}

export const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;

async function build(placeId: string): Promise<PreviewReport> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("PLACES_KEY_MISSING");

  const place = await fetchPlaceReviews(placeId, key);
  const withText = place.reviews.filter((r) => (r.review_text ?? "").trim().length > 0);

  const classified: ClassifiedReview[] = (
    await Promise.all(
      withText.map(async (r) => {
        try {
          const a = await analyzeReview({
            review_id: r.external_review_id,
            star_rating: r.star_rating,
            review_text: r.review_text as string,
          });
          return {
            star_rating: r.star_rating,
            review_text: r.review_text as string,
            reviewer_name: r.reviewer_name,
            reviewed_at: r.reviewed_at,
            categories: a.categories,
            danger_flags: a.danger_flags,
          } satisfies ClassifiedReview;
        } catch (e) {
          console.error("preview-report: analyzeReview failed", e);
          return null;
        }
      })
    )
  ).filter((x): x is ClassifiedReview => x !== null);

  // Don't cache a report whose analysis failed outright.
  if (withText.length > 0 && classified.length === 0) throw new Error("ANALYSIS_FAILED");

  const themes = aggregateThemes(classified);
  const risks = aggregateRisks(classified);

  let top_fixes: PreviewReport["top_fixes"] = [];
  let strengths: PreviewReport["strengths"] = [];
  if (classified.length > 0) {
    try {
      const s = await summarizePreviewReport(place.name, classified);
      top_fixes = s.top_fixes;
      strengths = s.strengths;
    } catch (e) {
      console.error("preview-report: summary failed", e);
    }
  }

  const dates = classified.map((r) => r.reviewed_at).sort();
  return {
    place_id: placeId,
    name: place.name,
    address: place.address,
    rating: place.rating,
    total_reviews: place.review_count,
    reviews_analyzed: classified.length,
    oldest_review_at: dates[0] ?? null,
    newest_review_at: dates[dates.length - 1] ?? null,
    themes,
    top_fixes,
    strengths,
    risks,
    generated_at: new Date().toISOString(),
  };
}

export function getPreviewReport(placeId: string): Promise<PreviewReport> {
  return unstable_cache(() => build(placeId), ["preview-report-v1", placeId], {
    revalidate: 60 * 60 * 24,
    tags: [`preview-report:${placeId}`],
  })();
}
