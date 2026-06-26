/**
 * Mock data for UI development — used when Supabase is not yet connected.
 * Replace these with real DB queries once credentials are in .env.local.
 */

import type {
  RankedIssue,
  CategoryRollup,
  DriftAlert,
  Location,
  SentimentCategory,
} from "@/types";

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
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
      "Staff seemed overwhelmed and unattentive all night.",
    ],
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
      "Service sentiment at Wynwood has dropped sharply over the past 30 days. Now in 61% 1–2★ territory.",
    detected_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
      "Wait time complaints at Downtown Miami have increased 22 points in the last 30 days.",
    detected_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    resolved: false,
    resolved_at: null,
    recovery_score: null,
    recovered_at: null,
  },
];

// 90-day trend data per category for charts
export function mockTrendData(category: SentimentCategory) {
  const points = 12; // 12 weeks
  const base: Record<SentimentCategory, number> = {
    food: 0.4,
    service: -0.2,
    atmosphere: 0.7,
    value: 0.3,
    wait_time: -0.4,
    cleanliness: 0.1,
  };
  return Array.from({ length: points }, (_, i) => {
    const week = new Date();
    week.setDate(week.getDate() - (points - i - 1) * 7);
    const jitter = (Math.random() - 0.5) * 0.25;
    const trend = category === "service" || category === "wait_time" ? -0.02 * i : 0.01 * i;
    return {
      week: week.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      score: Math.max(-1, Math.min(1, base[category] + jitter + trend)),
    };
  });
}

export const MOCK_ROLLUPS: CategoryRollup[] = (
  ["food", "service", "atmosphere", "value", "wait_time", "cleanliness"] as SentimentCategory[]
).map((cat) => ({
  id: `rollup-${cat}`,
  tenant_id: "tenant-1",
  location_id: "loc-1",
  category: cat,
  window_days: 90,
  window_end: new Date().toISOString().split("T")[0],
  mention_count: Math.floor(Math.random() * 80 + 20),
  positive_count: Math.floor(Math.random() * 40),
  negative_count: Math.floor(Math.random() * 30),
  neutral_count: Math.floor(Math.random() * 20),
  avg_sentiment_score: parseFloat((Math.random() * 1.6 - 0.8).toFixed(3)),
  sentiment_delta: parseFloat((Math.random() * 0.4 - 0.2).toFixed(3)),
  computed_at: new Date().toISOString(),
}));
