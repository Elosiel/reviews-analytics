// ── Core domain types ──────────────────────────────────────────────

export type SentimentCategory =
  | "food"
  | "service"
  | "atmosphere"
  | "value"
  | "wait_time"
  | "cleanliness";

export type Sentiment = "positive" | "neutral" | "negative";

export interface Location {
  id: string;
  user_id: string;
  google_location_id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  location_id: string;
  google_review_id: string;
  author_name: string;
  rating: number; // 1–5
  text: string;
  published_at: string;
  sentiment_score: number; // -1 to 1
  categories: ReviewCategory[];
  created_at: string;
}

export interface ReviewCategory {
  id: string;
  review_id: string;
  category: SentimentCategory;
  sentiment: Sentiment;
  score: number; // -1 to 1
  excerpt: string;
}

export interface CategoryInsight {
  category: SentimentCategory;
  sentiment_score: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_mentions: number;
  trend: "up" | "down" | "stable";
  top_issues: string[];
}

export interface DashboardSummary {
  location_id: string;
  period_start: string;
  period_end: string;
  overall_rating: number;
  total_reviews: number;
  new_reviews: number;
  sentiment_score: number;
  category_insights: CategoryInsight[];
  drift_alerts: DriftAlert[];
}

export interface DriftAlert {
  id: string;
  location_id: string;
  category: SentimentCategory;
  severity: "low" | "medium" | "high";
  message: string;
  detected_at: string;
  resolved: boolean;
}

// ── API response types ────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ── Auth ──────────────────────────────────────────────────────────

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
}
