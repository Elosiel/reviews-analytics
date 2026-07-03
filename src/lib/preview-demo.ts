/**
 * Demo data for the public /preview teaser.
 *
 * The teaser shows the "sliver" of a restaurant's reviews that Google
 * exposes publicly (aggregate rating + a handful of reviews via the
 * Places API) and contrasts it with the full analysis you unlock by
 * connecting the Business Profile API.
 *
 * These are clearly-labeled SAMPLE restaurants — we never fabricate
 * review data for a real business someone types in. When a live Google
 * Places key is wired (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), lookupPlace()
 * can be swapped to return real public data for any searched restaurant.
 */

import type { SentimentCategory } from "@/types";

export interface PreviewReview {
  author: string;
  rating: number; // 1–5
  text: string;
  relative_time: string;
}

export interface PreviewCategory {
  category: SentimentCategory;
  score: number; // -1 … 1
  label: string; // one-line teased insight (locked in the UI)
}

export interface PreviewPlace {
  id: string;
  name: string;
  address: string;
  /** Aggregate star rating Google shows publicly */
  rating: number;
  /** Total reviews on the listing */
  total_reviews: number;
  /** The ~3–5 reviews the Places API returns to anyone (the public sliver) */
  sample_reviews: PreviewReview[];
  /** The full picture — locked until they connect Business Profile */
  locked_categories: PreviewCategory[];
  /** Headline insight, blurred in the UI as the hook */
  locked_headline: string;
}

export const DEMO_PLACES: PreviewPlace[] = [
  {
    id: "demo-coral-gables",
    name: "Marisol — Coral Gables",
    address: "350 Miracle Mile, Coral Gables, FL",
    rating: 4.5,
    total_reviews: 428,
    sample_reviews: [
      {
        author: "Jessica R.",
        rating: 5,
        text: "The vibe is unmatched — perfect for a date night. Outdoor patio is stunning.",
        relative_time: "2 weeks ago",
      },
      {
        author: "Marcus T.",
        rating: 5,
        text: "Best ceviche in Coral Gables, not even close. The tasting menu blew us away.",
        relative_time: "a month ago",
      },
      {
        author: "Dani P.",
        rating: 4,
        text: "Beautiful room and great food. Service was a touch slow on a busy Friday.",
        relative_time: "a month ago",
      },
    ],
    locked_categories: [
      { category: "atmosphere", score: 0.81, label: "Atmosphere is your signature — guests bring it up unprompted." },
      { category: "food", score: 0.74, label: "Food is a strength, led by the ceviche and tasting menu." },
      { category: "service", score: 0.51, label: "Service is solid but slips on peak Friday/Saturday covers." },
      { category: "value", score: 0.28, label: "Value reads fair for the room — a few 'pricey' mentions." },
      { category: "wait_time", score: 0.1, label: "Wait times are mostly fine; watch the 7–8pm crunch." },
      { category: "cleanliness", score: 0.44, label: "Cleanliness rarely comes up — a quiet win." },
    ],
    locked_headline: "Atmosphere is carrying this location — but service dips exactly when you're busiest.",
  },
  {
    id: "demo-wynwood",
    name: "Marisol — Wynwood",
    address: "2200 NW 2nd Ave, Miami, FL",
    rating: 3.8,
    total_reviews: 187,
    sample_reviews: [
      {
        author: "Alex M.",
        rating: 2,
        text: "Server forgot our order twice and never apologized. Great space, rough night.",
        relative_time: "1 week ago",
      },
      {
        author: "Priya S.",
        rating: 3,
        text: "Loved the energy but waited 20 minutes before anyone acknowledged us.",
        relative_time: "3 weeks ago",
      },
      {
        author: "Tom K.",
        rating: 5,
        text: "Cocktails are incredible and the room is gorgeous. Came for a birthday.",
        relative_time: "a month ago",
      },
    ],
    locked_categories: [
      { category: "service", score: -0.72, label: "Service is the weak link — and it's dragging your rating." },
      { category: "food", score: -0.44, label: "Food complaints cluster on cold plates and portion size." },
      { category: "atmosphere", score: 0.38, label: "Atmosphere still lands — the room isn't the problem." },
      { category: "value", score: 0.12, label: "Value is neutral; guests forgive price when service is on." },
      { category: "wait_time", score: -0.21, label: "Wait times slipping alongside the service pressure." },
      { category: "cleanliness", score: 0.05, label: "Cleanliness is steady." },
    ],
    locked_headline: "Service sentiment has dropped sharply in 30 days — this is what's costing you stars.",
  },
  {
    id: "demo-downtown",
    name: "Marisol — Downtown Miami",
    address: "100 Brickell Ave, Miami, FL",
    rating: 4.2,
    total_reviews: 312,
    sample_reviews: [
      {
        author: "Sofia L.",
        rating: 4,
        text: "Huge portions for the price and the happy hour deals are incredible.",
        relative_time: "2 weeks ago",
      },
      {
        author: "Ryan G.",
        rating: 2,
        text: "45-minute wait for a table with a reservation. Food was great once it came.",
        relative_time: "3 weeks ago",
      },
      {
        author: "Nina F.",
        rating: 5,
        text: "The food turned around completely since my last visit — really impressed.",
        relative_time: "a month ago",
      },
    ],
    locked_categories: [
      { category: "value", score: 0.62, label: "Value is your standout — portions and happy hour win." },
      { category: "atmosphere", score: 0.55, label: "Atmosphere is strong and steady." },
      { category: "food", score: 0.42, label: "Food just recovered — a real before/after story to tell." },
      { category: "service", score: 0.18, label: "Service is fine but unremarkable." },
      { category: "cleanliness", score: -0.35, label: "Cleanliness has a few peak-hour mentions worth a sweep." },
      { category: "wait_time", score: -0.58, label: "Wait time is your problem — reservations aren't being honored." },
    ],
    locked_headline: "Reservations aren't being honored at peak — wait-time complaints are climbing.",
  },
];

/**
 * Look up a place for the teaser.
 *
 * Demo mode (no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY): matches the query against
 * the sample restaurants above. When a Places key is wired, this is the one
 * function to swap so the teaser searches any real restaurant's public data.
 */
export function searchDemoPlaces(query: string): PreviewPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEMO_PLACES;
  return DEMO_PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
  );
}

/** True once a live Google Maps/Places key is configured. */
export const HAS_MAPS_KEY = Boolean(
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
);

/** Free Maps Embed API URL (map visual only — no review data). */
export function mapEmbedUrl(place: PreviewPlace): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const q = encodeURIComponent(`${place.name} ${place.address}`);
  return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}`;
}
