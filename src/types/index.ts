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

// ── Domain types ──────────────────────────────────────────────────

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

// ── Drift alerts ─────────────────────────────────────────────────
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

// ── SOPs (Standard Operating Procedures) ─────────────────────────
// Brand-wide, one per category (unique per tenant+category while active).
// AI drafts a suggestion off a recurring drift alert; a manager reviews,
// edits, and activates it — RAAI never auto-publishes or silently
// rewrites an SOP a team is expected to follow.
export type SopStatus = "draft" | "active" | "archived";

export interface Sop {
  id: string;
  tenant_id: string;
  category: SentimentCategory;
  title: string;
  content: string;
  status: SopStatus;
  ai_generated: boolean;
  source_summary: string | null;
  source_drift_alert_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
}

// Evidence quote backing an SOP draft. quote_text is null after
// content_purge_at (copied from the source review — not a fresh timer).
export interface SopEvidenceQuote {
  id: string;
  tenant_id: string;
  sop_id: string;
  review_id: string | null;
  location_id: string | null;
  location_name: string;
  quote_text: string | null;
  star_rating: number | null;
  reviewed_at: string | null;
  content_purge_at: string;
}

// ── Dashboard data shapes (composed from rollups + alerts) ───────

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
  // AI-generated action, grounded in the quotes + the restaurant profile
  recommendation?: string;
}

// ── Restaurant profile (tenant_profiles) ─────────────────────────
// Collected at onboarding, editable on the "Your restaurant" page.
// Fed to Claude so recommendations match the restaurant's mission,
// guests, and goals.
export interface RestaurantProfile {
  tenant_id?: string;
  mission: string;          // what the restaurant is about, in the owner's words
  cuisine_style: string;    // e.g. "Coastal Italian, upscale-casual full service"
  target_guests: string;    // e.g. "date nights, business dinners, local regulars"
  price_point: "$" | "$$" | "$$$" | "$$$$";
  goals: string;            // e.g. "hold 4.5★ across all locations, grow private events"
  notes: string;            // anything else the AI should know
  website_url: string;      // the restaurant's site — AI reads it for voice + facts
  menu_url: string;         // online menu link, if separate from the site
}

// ── Restaurant documents (tenant_documents + Storage) ────────────
// Menus, promotions, wine lists, brand one-pagers — uploaded on the
// "Your restaurant" page. Text is extracted and fed to Claude alongside
// the profile so recommendations (and the future Respond tier) can
// speak with the restaurant's own facts.
export type DocumentKind =
  | "menu"
  | "promotion"
  | "wine_list"
  | "brand"
  | "policy"
  | "other";

export interface TenantDocument {
  id: string;
  tenant_id?: string;
  kind: DocumentKind;
  title: string;            // display name, defaults to the file name
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path?: string;    // path inside the tenant-docs Storage bucket
  uploaded_at: string;
  // ready = stored and available to the AI pipeline
  status: "processing" | "ready";
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

// ── Meetings ──────────────────────────────────────────────────────
// On-demand, manager-generated agendas built from filtered review
// trends — the tab that turns "read hundreds of reviews" into a
// ready-made agenda. Saved to a filterable history (location, city,
// date, category).
export interface MeetingFilters {
  location_ids: string[] | null;  // null = all locations
  city: string | null;            // null = all cities
  categories: SentimentCategory[] | null; // null = all categories
  date_start: string;              // date
  date_end: string;                // date
}

// One discussion item on a meeting's agenda — the paraphrased analysis
// half of the record (retained indefinitely). Verbatim evidence lives
// separately in MeetingQuoteSnapshot so it can carry its own purge clock.
export interface MeetingAgendaIssue {
  category: SentimentCategory;
  location_id: string;
  location_name: string;
  mention_count: number;
  avg_sentiment_score: number;
  sentiment_delta: number | null;
  severity: AlertSeverity | null;
  discussion_point: string;   // what to raise with the team, in plain language
  suggested_action: string;   // the concrete step to leave the meeting with
  linked_sop_id?: string;     // active SOP for this category, if one exists
}

export interface Meeting {
  id: string;
  tenant_id: string;
  title: string;
  filters: MeetingFilters;
  agenda: MeetingAgendaIssue[];
  generated_at: string;
  created_by: string | null;
}

// Evidence quote backing a meeting's agenda. quote_text is null after
// content_purge_at (copied from the source review — not a fresh timer).
export interface MeetingQuoteSnapshot {
  id: string;
  tenant_id: string;
  meeting_id: string;
  review_id: string | null;
  location_id: string | null;
  location_name: string;
  category: SentimentCategory;
  quote_text: string | null;
  star_rating: number | null;
  reviewed_at: string | null;
  content_purge_at: string;
}

// ── API shapes ────────────────────────────────────────────────────

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
