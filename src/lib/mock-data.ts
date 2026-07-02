/**
 * Demo data for UI development and sales demos — used until real locations
 * are connected. Everything here is DETERMINISTIC (no Math.random, no
 * new Date() in values that render) so server and client markup match.
 *
 * The story: a 3-location Miami group. Coral Gables is the star,
 * Wynwood is the weak link (service collapsing), Downtown has a wait-time
 * problem but just recovered its food scores — the proof-of-impact story.
 */

import type {
  RankedIssue,
  DriftAlert,
  Location,
  RestaurantProfile,
  SentimentCategory,
} from "@/types";

// ── Restaurant profile (collected at onboarding, editable in Settings) ──
// Recommendations below are written against this profile on purpose —
// this is what the real Claude pipeline will do per-tenant.
export const MOCK_PROFILE: RestaurantProfile = {
  mission:
    "Coastal Latin cooking that makes an ordinary Tuesday feel like a night away.",
  cuisine_style: "Coastal Latin, upscale-casual full service",
  target_guests: "Date nights, business dinners, and neighborhood regulars",
  price_point: "$$$",
  goals: "Hold 4.5★ across all three locations and grow private events",
  notes: "Wynwood skews younger and louder; Coral Gables is the flagship.",
};

export const MOCK_LOCATIONS: Location[] = [
  {
    id: "loc-1",
    tenant_id: "tenant-1",
    user_id: "user-1",
    google_account_id: "accounts/123",
    google_location_id: "locations/111",
    name: "Downtown Miami",
    address: "100 Brickell Ave, Miami, FL",
    rating: 4.2,
    review_count: 312,
    connection_broken: false,
    connection_broken_at: null,
    last_synced_at: "2026-07-02T06:00:00Z",
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-07-02T06:00:00Z",
  },
  {
    id: "loc-2",
    tenant_id: "tenant-1",
    user_id: "user-1",
    google_account_id: "accounts/123",
    google_location_id: "locations/222",
    name: "Wynwood",
    address: "2200 NW 2nd Ave, Miami, FL",
    rating: 3.8,
    review_count: 187,
    connection_broken: false,
    connection_broken_at: null,
    last_synced_at: "2026-07-02T06:00:00Z",
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-07-02T06:00:00Z",
  },
  {
    id: "loc-3",
    tenant_id: "tenant-1",
    user_id: "user-1",
    google_account_id: "accounts/123",
    google_location_id: "locations/333",
    name: "Coral Gables",
    address: "350 Miracle Mile, Coral Gables, FL",
    rating: 4.5,
    review_count: 428,
    connection_broken: false,
    connection_broken_at: null,
    last_synced_at: "2026-07-02T06:00:00Z",
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-07-02T06:00:00Z",
  },
];

// ── Cross-location matrix: 90-day rollup per location × category ──
export interface MatrixCell {
  score: number;
  delta: number;
  mentions: number;
}

export const MOCK_MATRIX: Record<
  string,
  Record<SentimentCategory, MatrixCell>
> = {
  "loc-1": {
    food: { score: 0.42, delta: 0.35, mentions: 86 }, // recovered — see MOCK_RECOVERY
    service: { score: 0.18, delta: -0.06, mentions: 74 },
    atmosphere: { score: 0.55, delta: 0.02, mentions: 61 },
    value: { score: 0.62, delta: 0.05, mentions: 31 },
    wait_time: { score: -0.58, delta: -0.22, mentions: 28 },
    cleanliness: { score: -0.35, delta: -0.08, mentions: 9 },
  },
  "loc-2": {
    food: { score: -0.44, delta: -0.18, mentions: 21 },
    service: { score: -0.72, delta: -0.31, mentions: 34 },
    atmosphere: { score: 0.38, delta: 0.01, mentions: 26 },
    value: { score: 0.12, delta: -0.04, mentions: 18 },
    wait_time: { score: -0.21, delta: -0.11, mentions: 15 },
    cleanliness: { score: 0.05, delta: 0.0, mentions: 11 },
  },
  "loc-3": {
    food: { score: 0.74, delta: 0.09, mentions: 52 },
    service: { score: 0.51, delta: 0.04, mentions: 47 },
    atmosphere: { score: 0.81, delta: 0.12, mentions: 67 },
    value: { score: 0.28, delta: -0.02, mentions: 22 },
    wait_time: { score: 0.1, delta: 0.03, mentions: 12 },
    cleanliness: { score: 0.44, delta: 0.06, mentions: 17 },
  },
};

export const MOCK_RANKED_ISSUES: RankedIssue[] = [
  {
    category: "service",
    location_id: "loc-2",
    location_name: "Wynwood",
    mention_count: 34,
    avg_sentiment_score: -0.72,
    sentiment_delta: -0.31,
    severity: "high",
    quotes: [
      "Server forgot our order twice and never apologized.",
      "Waited 20 minutes before anyone acknowledged us.",
      "Staff seemed overwhelmed and inattentive all night.",
    ],
    recommendation:
      "Your core guests are date nights — a slow first greeting kills that experience before the food arrives. Set a 90-second greet standard, add one floor lead on Friday and Saturday, and run the greet drill at Tuesday's pre-shift. If staffing is the constraint, cut two tables from the Friday book until hiring catches up. Expect mentions to fall within two weeks.",
  },
  {
    category: "wait_time",
    location_id: "loc-1",
    location_name: "Downtown Miami",
    mention_count: 28,
    avg_sentiment_score: -0.58,
    sentiment_delta: -0.22,
    severity: "medium",
    quotes: [
      "45-minute wait for a table with a reservation.",
      "Food took forever to come out even when the place was half empty.",
    ],
    recommendation:
      "Complaints cluster on reservations not being honored — that's a table-matrix problem, not a demand problem. Audit Friday's book against actual turn times, stop double-seating the 7–8pm slot, and quote walk-ins honestly. Business dinners are in your profile; they forgive a wait they were told about, never one they weren't.",
  },
  {
    category: "food",
    location_id: "loc-2",
    location_name: "Wynwood",
    mention_count: 21,
    avg_sentiment_score: -0.44,
    sentiment_delta: -0.18,
    severity: "medium",
    quotes: [
      "Pasta was cold when it arrived.",
      "Portion sizes have definitely shrunk since last time.",
    ],
    recommendation:
      "Cold plates plus 'portions shrunk' usually means food dying in the pass, not the recipe. Check expo coverage on Wynwood's peak nights and whether hot plates are actually being used. Downtown just fixed this exact pattern in six weeks — copy their pass-timing standard before changing the menu.",
  },
  {
    category: "cleanliness",
    location_id: "loc-1",
    location_name: "Downtown Miami",
    mention_count: 9,
    avg_sentiment_score: -0.35,
    sentiment_delta: -0.08,
    severity: "low",
    quotes: ["Bathroom needed attention during peak hours."],
    recommendation:
      "One mention, but at a $$$ price point bathrooms are part of the experience. Add a 7pm and 9pm sweep to the closing checklist with initials on the door card — a two-minute fix that protects the date-night impression you're selling.",
  },
];

export const MOCK_LOVES: RankedIssue[] = [
  {
    category: "atmosphere",
    location_id: "loc-3",
    location_name: "Coral Gables",
    mention_count: 67,
    avg_sentiment_score: 0.81,
    sentiment_delta: 0.12,
    severity: null,
    quotes: [
      "The vibe is unmatched — perfect for a date night.",
      "Love the outdoor patio, so relaxing.",
    ],
  },
  {
    category: "food",
    location_id: "loc-3",
    location_name: "Coral Gables",
    mention_count: 52,
    avg_sentiment_score: 0.74,
    sentiment_delta: 0.09,
    severity: null,
    quotes: [
      "Best ceviche in Coral Gables, not even close.",
      "The tasting menu blew us away.",
    ],
  },
  {
    category: "value",
    location_id: "loc-1",
    location_name: "Downtown Miami",
    mention_count: 31,
    avg_sentiment_score: 0.62,
    sentiment_delta: 0.05,
    severity: null,
    quotes: ["Huge portions for the price.", "Happy hour deals are incredible."],
  },
];

export const MOCK_DRIFT_ALERTS: DriftAlert[] = [
  {
    id: "alert-1",
    tenant_id: "tenant-1",
    location_id: "loc-2",
    category: "service",
    severity: "high",
    score_before: -0.41,
    score_after: -0.72,
    delta: -0.31,
    message:
      "Service sentiment at Wynwood has dropped sharply over the past 30 days.",
    detected_at: "2026-06-30T08:00:00Z",
    resolved: false,
    resolved_at: null,
    recovery_score: null,
    recovered_at: null,
  },
  {
    id: "alert-2",
    tenant_id: "tenant-1",
    location_id: "loc-1",
    category: "wait_time",
    severity: "medium",
    score_before: -0.36,
    score_after: -0.58,
    delta: -0.22,
    message:
      "Wait time complaints at Downtown Miami have increased over the last 30 days.",
    detected_at: "2026-06-27T08:00:00Z",
    resolved: false,
    resolved_at: null,
    recovery_score: null,
    recovered_at: null,
  },
];

// ── Proof of impact: a flagged category that recovered ──
export const MOCK_RECOVERY: DriftAlert = {
  id: "alert-0",
  tenant_id: "tenant-1",
  location_id: "loc-1",
  category: "food",
  severity: "medium",
  score_before: -0.38,
  score_after: -0.38,
  delta: -0.24,
  message: "Cold-food complaints at Downtown Miami.",
  detected_at: "2026-05-12T08:00:00Z",
  resolved: true,
  resolved_at: "2026-06-23T08:00:00Z",
  recovery_score: 0.42,
  recovered_at: "2026-06-23T08:00:00Z",
};

// ── Danger flag: surfaced regardless of category (spec rule 6) ──
export interface NeedsAttentionItem {
  id: string;
  location_id: string;
  location_name: string;
  flag: "health_safety" | "legal" | "discrimination" | "physical_safety";
  star_rating: number;
  quote: string;
  reviewed_at: string;
}

export const MOCK_NEEDS_ATTENTION: NeedsAttentionItem[] = [
  {
    id: "flag-1",
    location_id: "loc-2",
    location_name: "Wynwood",
    flag: "health_safety",
    star_rating: 1,
    quote:
      "Both of us felt sick within hours of eating the shrimp special. Something was off.",
    reviewed_at: "2026-06-30T21:14:00Z",
  },
];

// ── This week, in numbers (powers the header narrative + Monday brief) ──
export const MOCK_WEEK = {
  new_reviews: 47,
  avg_rating: 4.3,
  rating_delta: 0.1,
  best: { category: "atmosphere" as SentimentCategory, location: "Coral Gables" },
  worst: { category: "service" as SentimentCategory, location: "Wynwood" },
  digest_email: "you@yourrestaurant.com",
};

// ── 90-day weekly trend per category (deterministic — no randomness) ──
const TREND_SHAPE: Record<
  SentimentCategory,
  { base: number; slope: number; phase: number }
> = {
  food: { base: 0.18, slope: 0.021, phase: 0.8 },       // recovering
  service: { base: 0.05, slope: -0.028, phase: 2.1 },   // declining
  atmosphere: { base: 0.62, slope: 0.008, phase: 4.2 }, // strong, stable
  value: { base: 0.3, slope: 0.004, phase: 1.4 },
  wait_time: { base: -0.22, slope: -0.014, phase: 3.3 },// slipping
  cleanliness: { base: 0.08, slope: -0.003, phase: 5.0 },
};

const TREND_WEEKS = [
  "Apr 6", "Apr 13", "Apr 20", "Apr 27",
  "May 4", "May 11", "May 18", "May 25",
  "Jun 1", "Jun 8", "Jun 15", "Jun 22", "Jun 29",
];

export function mockTrendData(category: SentimentCategory) {
  const { base, slope, phase } = TREND_SHAPE[category];
  return TREND_WEEKS.map((week, i) => ({
    week,
    score: Math.max(
      -1,
      Math.min(1, base + slope * i + 0.09 * Math.sin(i * 1.7 + phase))
    ),
  }));
}

// Whole-business average: every category, every location, mention-weighted.
// Derived from the same category shapes so all views tell one story —
// a spring dip (Downtown's food problem) followed by a steady recovery.
export function mockGroupTrend() {
  const cats = Object.keys(TREND_SHAPE) as SentimentCategory[];
  const weights: Record<SentimentCategory, number> = {
    food: 159, service: 155, atmosphere: 154,
    value: 71, wait_time: 55, cleanliness: 37,
  };
  const totalWeight = cats.reduce((s, c) => s + weights[c], 0);
  return TREND_WEEKS.map((week, i) => {
    const score =
      cats.reduce((sum, c) => {
        const { base, slope, phase } = TREND_SHAPE[c];
        return (
          sum +
          weights[c] *
            Math.max(-1, Math.min(1, base + slope * i + 0.09 * Math.sin(i * 1.7 + phase)))
        );
      }, 0) / totalWeight;
    return { week, score: Math.round(score * 100) / 100 };
  });
}
