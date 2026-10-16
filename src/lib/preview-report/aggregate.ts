/**
 * Pure aggregation for the public-reviews preview report. No I/O, so it is
 * unit-tested in tests/preview-report-aggregate.test.ts.
 *
 * Input: the handful of public reviews Google exposes for a place (Places
 * API caps this at ~5) plus the per-review classification from
 * analyzeReview(). Output: per-category themes, risk flags, and the raw
 * material for the "top fixes" summary. Nothing is invented — every number
 * is computed from the reviews actually fetched.
 */

import type { SentimentCategory } from "@/types";

export const PREVIEW_CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];

export interface ClassifiedReview {
  star_rating: number;
  review_text: string;
  reviewer_name: string | null;
  reviewed_at: string;
  categories: { category: SentimentCategory; sentiment_score: number; confidence: number }[];
  danger_flags: { health_safety: boolean; legal: boolean; discrimination: boolean; physical_safety: boolean };
}

export interface PreviewTheme {
  category: SentimentCategory;
  mentions: number;
  avg_sentiment: number; // -1..1
  negative_mentions: number;
  positive_mentions: number;
  quotes: { text: string; stars: number; sentiment: number }[];
}

export interface PreviewRisk {
  flag: "health_safety" | "legal" | "discrimination" | "physical_safety";
  count: number;
  quotes: string[];
}

const QUOTE_MAX = 220;

export function shortQuote(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= QUOTE_MAX ? t : `${t.slice(0, QUOTE_MAX - 1).trimEnd()}…`;
}

export function aggregateThemes(reviews: ClassifiedReview[]): PreviewTheme[] {
  const themes: PreviewTheme[] = [];
  for (const category of PREVIEW_CATEGORIES) {
    const hits = reviews
      .map((r) => ({ r, c: r.categories.find((c) => c.category === category) }))
      .filter((x): x is { r: ClassifiedReview; c: ClassifiedReview["categories"][number] } => !!x.c);
    if (hits.length === 0) continue;
    const avg = hits.reduce((s, h) => s + h.c.sentiment_score, 0) / hits.length;
    themes.push({
      category,
      mentions: hits.length,
      avg_sentiment: Math.round(avg * 100) / 100,
      negative_mentions: hits.filter((h) => h.c.sentiment_score < -0.15).length,
      positive_mentions: hits.filter((h) => h.c.sentiment_score > 0.15).length,
      quotes: hits
        .slice()
        .sort((a, b) => Math.abs(b.c.sentiment_score) - Math.abs(a.c.sentiment_score))
        .slice(0, 2)
        .map((h) => ({ text: shortQuote(h.r.review_text), stars: h.r.star_rating, sentiment: h.c.sentiment_score })),
    });
  }
  // Most-discussed first; ties → most negative first (what to fix).
  return themes.sort((a, b) => b.mentions - a.mentions || a.avg_sentiment - b.avg_sentiment);
}

export function aggregateRisks(reviews: ClassifiedReview[]): PreviewRisk[] {
  const flags: PreviewRisk["flag"][] = ["health_safety", "legal", "discrimination", "physical_safety"];
  return flags
    .map((flag) => {
      const hits = reviews.filter((r) => r.danger_flags[flag]);
      return { flag, count: hits.length, quotes: hits.slice(0, 2).map((r) => shortQuote(r.review_text)) };
    })
    .filter((r) => r.count > 0);
}
