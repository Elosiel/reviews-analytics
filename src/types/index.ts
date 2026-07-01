// ── Fixed category taxonomy (locked — do not add categories without spec change) ──
// food | service | atmosphere | value | wait_time | cleanliness
export type SentimentCategory =
  | "food"
  | "service"
  | "atmosphere"
  | "value"
  | "wait_time"
  | "cleanliness";

export type Sentiment = "positive" | "neutral" | "negative";

export type AlertSeverity = "low" | "medium" | "high";

// ── Drift alert thresholds (paper-agreed, change only after design-partner feedback) ──
// medium: sentiment_delta < -0.2 over 30-day window
// high:   sentiment_delta < -0.4 over 30-day window
export const DRIFT_THRESHOLD = { medium: -0.2, high: -0.4 } as const;

// ── Domain types ────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "operator" | "tenant";
  plan: "trial" | "standard" | "enterprise";
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  tenant_id: string;
  user_id: string;
  google_account_id: string;
  google_location_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  connection_broken: boolean;
  connection_broken_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Canonical review JSON — agreed on paper, matches ingest schema exactly.
// review_text and reviewer_name are null after content_purge_at (30 days).
export interface Review {
  id: string;
  tenant_id: string;
  location_id: string;
  external_review_id: string;  // Google review id
  source: "google";
  star_rating: number;         // 1–5
  review_text: string | null;  // null after 30-day purge
  reviewer_name: string | null;// null after 30-day purge
  reviewed_at: string;
  ingested_at: string;
  content_purge_at: string;    // generated: ingested_at + 30 days
  status: "ingested";
}

// ── AI analysis output (per review, stored in review_analyses) ───
// model: Anthropic Claude only — no OpenAI.
export interface ReviewAnalysis {
  id: string;
  tenant_id: string;
  review_id: string;
  model_used: "claude";
  flag_health_safety: boolean;
  flag_legal: boolean;
  flag_discrimination: boolean;
  flag_physical_safety: boolean;
  needs_attention: boolean;    // generated: any flag = true
  analyzed_at: string;
  categories: ReviewCategoryScore[];
}

// Per-category sentiment for a single review
export interface ReviewCategoryScore {
  id: string;
  tenant_id: string;
  analysis_id: string;
  review_id: string;
  category: SentimentCategory;
  sentiment_score: number;   // -1.000 to 1.000
  confidence: number;        // 0.000 to 1.000
  sentiment: Sentiment;      // generated from score
}

// ── Pre-aggregated rollups (dashboard + digest both read from here) ──
// Never query raw reviews on dashboard load — always use category_rollups.
export interface CategoryRollup {
  id: string;
  tenant_id: string;
  location_id: string;
  category: SentimentCategory;
  window_days: 7 | 30 | 90;
  window_end: string;         // date
  mention_count: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  avg_sentiment_score: number | null;
  sentiment_delta: number | null; // current - prior period (signed)
  computed_at: string;
}

// ── Drift alerts ─────────────────────────────────────────────────────
export interface DriftAlert {
  id: string;
  tenant_id: string;
  location_id: string;
  category: SentimentCategory;
  severity: AlertSeverity;
  score_before: number;
  score_after: number;
  delta: number;              // generated: score_after - score_before
  message: string;
  detected_at: string;
  resolved: boolean;
  resolved_at: string | null;
  // Proof-of-impact fields — surface recovery explicitly in the dashboard
  recovery_score: number | null;
  recovered_at: string | null;
}

// ── Dashboard data shapes (composed from rollups + alerts) ────────────

// Ranked to-do list item — the literal product output
export interface RankedIssue {
  category: SentimentCategory;
  location_id: string;
  location_name: string;
  mention_count: number;
  avg_sentiment_score: number;
  sentiment_delta: number | null;
  severity: AlertSeverity | null;
  // Representative verbatim quotes from rolling 30-day window only
  quotes: string[];
}

// Cross-location roll-up — the core group-operator value
export interface CrossLocationRollup {
  category: SentimentCategory;
  locations: {
    location_id: string;
    location_name: string;
    avg_sentiment_score: number;
    mention_count: number;
    sentiment_delta: number | null;
  }[];
  weakest_location_id: string;
  strongest_location_id: string;
}

// Shift meeting card — one-tap export per top-ranked issue
export interface ShiftMeetingCard {
  issue: RankedIssue;
  generated_at: string;
  // Only quotes from within the 30-day compliant window
  evidence_quotes: { text: string; star_rating: number; reviewed_at: string }[];
}

// ── API shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Claude analysis request/response (internal — never exposed to client)
export interface ClaudeAnalysisRequest {
  review_id: string;
  star_rating: number;
  review_text: string;
}

export interface ClaudeAnalysisResponse {
  categories: {
    category: SentimentCategory;
    sentiment_score: number;
    confidence: number;
  }[];
  danger_flags: {
    health_safety: boolean;
    legal: boolean;
    discrimination: boolean;
    physical_safety: boolean;
  };
}
