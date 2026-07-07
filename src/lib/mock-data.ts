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
  Sop,
  Meeting,
  MeetingQuoteSnapshot,
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
  website_url: "https://www.marisolmiami.com",
  menu_url: "https://www.marisolmiami.com/menus",
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
      "Your core guests are date nights, and a slow first greeting sets the tone before the food ever arrives. We'd suggest trying a 90-second greet standard and adding one floor lead on Friday and Saturday — the greet drill could fit naturally into Tuesday's pre-shift. If staffing is the constraint, temporarily trimming two tables from the Friday book may relieve the pressure. Groups who've made this change usually see mentions ease within two weeks.",
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
      "Complaints cluster on reservations not being honored — that usually points to the table matrix rather than demand. It may be worth auditing Friday's book against actual turn times and easing off double-seating the 7–8pm slot, while quoting walk-ins honestly. Business dinners are core to your profile, and they tend to forgive a wait they were told about far more than one they weren't.",
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
      "Cold plates plus 'portions shrunk' usually suggests food waiting in the pass rather than a recipe problem. We'd recommend looking at expo coverage on Wynwood's peak nights and whether hot plates are actually in use. Downtown worked through this exact pattern in six weeks — their pass-timing standard could be worth borrowing before considering any menu changes.",
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
      "Only one mention so far, but at a $$$ price point bathrooms are part of the experience. A 7pm and 9pm sweep added to the checklist, with initials on the door card, could be a simple two-minute habit that protects the date-night impression you're selling.",
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

// ── SOPs — one per category, brand-wide across the group ─────────
// The food SOP is already active and is what actually drove
// MOCK_RECOVERY (Downtown's cold-food complaints turning around) —
// proof the loop works. The service and wait_time SOPs are AI drafts
// awaiting manager approval, drafted straight from MOCK_DRIFT_ALERTS.
export const MOCK_SOPS: Sop[] = [
  {
    id: "sop-1",
    tenant_id: "tenant-1",
    category: "food",
    title: "Hot-Plate Pass Standard",
    status: "active",
    ai_generated: true,
    content:
      "PURPOSE: Guests kept saying plates arrived cold — that's a pass-timing problem, not a recipe problem.\nSTANDARD: 1) Expo confirms every hot dish leaves the pass on a heated plate, no exceptions. 2) No plate sits on the pass longer than 90 seconds before runner pickup. 3) Runners announce table number before touching a plate, so expo can flag anything stalling. 4) Friday/Saturday peak gets a dedicated expo, not a shared role. 5) Manager spot-checks plate temperature at the table during Friday service.\nHOW WE'LL KNOW IT'S WORKING: Food sentiment at the flagged location trending back above 0 within four weeks.",
    source_summary:
      "Drafted from a medium drift alert at Downtown Miami — food down 0.24 over 30 days.",
    source_drift_alert_id: "alert-0",
    created_by: "user-1",
    created_at: "2026-05-15T14:00:00Z",
    updated_at: "2026-06-23T09:00:00Z",
    activated_at: "2026-05-20T09:00:00Z",
  },
  {
    id: "sop-2",
    tenant_id: "tenant-1",
    category: "service",
    title: "Table Greeting & Wait-Time Standard",
    status: "draft",
    ai_generated: true,
    content:
      "PURPOSE: Guests at Wynwood are waiting too long to be acknowledged, and staff attentiveness is the top complaint driving the drop.\nSTANDARD: 1) Every table gets a verbal greeting within 90 seconds of being seated, even if it's just a server passing by. 2) Orders are read back to the table before leaving to confirm accuracy. 3) A floor lead is scheduled on Friday and Saturday nights specifically to catch tables slipping through the cracks. 4) Pre-shift huddle includes a 2-minute greet drill on busy nights. 5) If a table waits past the 90-second mark, any staff member — not just their assigned server — greets them.\nHOW WE'LL KNOW IT'S WORKING: Service mentions at Wynwood easing back toward flat within two weeks of rollout.",
    source_summary:
      "Drafted from a high drift alert at Wynwood — service down 0.31 over 30 days.",
    source_drift_alert_id: "alert-1",
    created_by: null,
    created_at: "2026-07-05T10:00:00Z",
    updated_at: "2026-07-05T10:00:00Z",
    activated_at: null,
  },
  {
    id: "sop-3",
    tenant_id: "tenant-1",
    category: "wait_time",
    title: "Reservation & Table-Matrix Standard",
    status: "draft",
    ai_generated: true,
    content:
      "PURPOSE: Reservation waits are increasing at Downtown even with tables held, which points at the booking matrix rather than true demand.\nSTANDARD: 1) No double-seating the 7–8pm slot without host-stand sign-off. 2) Walk-ins are quoted an honest wait, updated every 15 minutes if it shifts. 3) Host stand reviews Friday's book against last week's actual turn times before doors open. 4) Any reservation waiting past 15 minutes gets a manager check-in at the table, not just an apology at seating.\nHOW WE'LL KNOW IT'S WORKING: Wait-time mentions at Downtown flattening out over the next 30-day window.",
    source_summary:
      "Drafted from a medium drift alert at Downtown Miami — wait_time down 0.22 over 30 days.",
    source_drift_alert_id: "alert-2",
    created_by: null,
    created_at: "2026-07-02T10:00:00Z",
    updated_at: "2026-07-02T10:00:00Z",
    activated_at: null,
  },
];

// Evidence quotes behind each draft — display-only in the demo; in
// production these come from sop_evidence_quotes and carry the source
// review's own content_purge_at (nulled by the same daily job as
// reviews.review_text, not a fresh 30-day timer).
export const MOCK_SOP_EVIDENCE: Record<
  string,
  { location_name: string; quote: string }[]
> = {
  "sop-2": [
    { location_name: "Wynwood", quote: "Server forgot our order twice and never apologized." },
    { location_name: "Wynwood", quote: "Waited 20 minutes before anyone acknowledged us." },
    { location_name: "Wynwood", quote: "Staff seemed overwhelmed and inattentive all night." },
  ],
  "sop-3": [
    { location_name: "Downtown Miami", quote: "45-minute wait for a table with a reservation." },
    { location_name: "Downtown Miami", quote: "Food took forever to come out even when the place was half empty." },
  ],
};

// ── Meetings — on-demand agendas saved to history ─────────────────
// Discussion points + suggested actions are deliberately worded
// differently from MOCK_RANKED_ISSUES' recommendations — a meeting
// agenda is what you say out loud to the team, not the written advice.
export const MOCK_MEETINGS: Meeting[] = [
  {
    id: "meeting-1",
    tenant_id: "tenant-1",
    title: "All locations · Jun 30 to Jul 6, 2026",
    filters: {
      location_ids: null,
      city: null,
      categories: null,
      date_start: "2026-06-30",
      date_end: "2026-07-06",
    },
    agenda: [
      {
        category: "service",
        location_id: "loc-2",
        location_name: "Wynwood",
        mention_count: 34,
        avg_sentiment_score: -0.72,
        sentiment_delta: -0.31,
        severity: "high",
        discussion_point:
          "Wynwood guests are waiting too long to even be greeted, and it's the single biggest driver of this week's negative mentions.",
        suggested_action:
          "Roll out the greet-within-90-seconds standard starting this weekend and put a floor lead on both Friday and Saturday.",
        linked_sop_id: "sop-2",
      },
      {
        category: "wait_time",
        location_id: "loc-1",
        location_name: "Downtown Miami",
        mention_count: 28,
        avg_sentiment_score: -0.58,
        sentiment_delta: -0.22,
        severity: "medium",
        discussion_point:
          "Downtown reservation waits keep coming up — guests feel like their booking didn't matter.",
        suggested_action:
          "Have the host stand audit Friday's book against real turn times before doors open this week.",
        linked_sop_id: "sop-3",
      },
      {
        category: "food",
        location_id: "loc-2",
        location_name: "Wynwood",
        mention_count: 21,
        avg_sentiment_score: -0.44,
        sentiment_delta: -0.18,
        severity: "medium",
        discussion_point:
          "Cold plates and shrinking portions are being mentioned together at Wynwood — worth checking if it's an expo timing issue like Downtown had.",
        suggested_action:
          "Borrow Downtown's hot-plate pass standard for Wynwood's peak nights before considering any menu changes.",
        linked_sop_id: "sop-1",
      },
    ],
    generated_at: "2026-07-06T15:30:00Z",
    created_by: "user-1",
  },
  {
    id: "meeting-2",
    tenant_id: "tenant-1",
    title: "Wynwood · Jun 23 to Jun 29, 2026",
    filters: {
      location_ids: ["loc-2"],
      city: null,
      categories: ["service", "food"],
      date_start: "2026-06-23",
      date_end: "2026-06-29",
    },
    agenda: [
      {
        category: "service",
        location_id: "loc-2",
        location_name: "Wynwood",
        mention_count: 19,
        avg_sentiment_score: -0.68,
        sentiment_delta: -0.24,
        severity: "high",
        discussion_point:
          "Same greet-time complaints as last week at Wynwood — this hasn't turned around yet.",
        suggested_action:
          "Confirm the floor lead schedule actually happened last weekend before adding anything new.",
        linked_sop_id: "sop-2",
      },
    ],
    generated_at: "2026-06-29T16:00:00Z",
    created_by: "user-1",
  },
];

// Evidence quotes behind each saved meeting's agenda — same purge
// semantics as MOCK_SOP_EVIDENCE; keyed here by meeting id for the
// demo's print/copy view.
export const MOCK_MEETING_QUOTES: Record<string, MeetingQuoteSnapshot[]> = {
  "meeting-1": [
    {
      id: "mq-1", tenant_id: "tenant-1", meeting_id: "meeting-1",
      review_id: "rev-1", location_id: "loc-2", location_name: "Wynwood",
      category: "service", quote_text: "Server forgot our order twice and never apologized.",
      star_rating: 2, reviewed_at: "2026-07-01T20:00:00Z", content_purge_at: "2026-07-31T20:00:00Z",
    },
    {
      id: "mq-2", tenant_id: "tenant-1", meeting_id: "meeting-1",
      review_id: "rev-2", location_id: "loc-1", location_name: "Downtown Miami",
      category: "wait_time", quote_text: "45-minute wait for a table with a reservation.",
      star_rating: 2, reviewed_at: "2026-07-02T19:30:00Z", content_purge_at: "2026-08-01T19:30:00Z",
    },
    {
      id: "mq-3", tenant_id: "tenant-1", meeting_id: "meeting-1",
      review_id: "rev-3", location_id: "loc-2", location_name: "Wynwood",
      category: "food", quote_text: "Pasta was cold when it arrived.",
      star_rating: 3, reviewed_at: "2026-07-03T18:45:00Z", content_purge_at: "2026-08-02T18:45:00Z",
    },
  ],
  "meeting-2": [
    {
      id: "mq-4", tenant_id: "tenant-1", meeting_id: "meeting-2",
      review_id: "rev-4", location_id: "loc-2", location_name: "Wynwood",
      category: "service", quote_text: "Waited 20 minutes before anyone acknowledged us.",
      star_rating: 2, reviewed_at: "2026-06-25T20:15:00Z", content_purge_at: "2026-07-25T20:15:00Z",
    },
  ],
};
