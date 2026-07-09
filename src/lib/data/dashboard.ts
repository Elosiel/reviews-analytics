/**
 * Real dashboard data — replaces mock-data.ts once a tenant has at least
 * one real location. Reads exclusively from category_rollups for scores/
 * deltas/mention counts (never a live aggregate over raw reviews — see
 * CLAUDE.md rule 1); the only live joins to `reviews` here are for pulling
 * verbatim quote text, which by definition isn't something a rollup can
 * store.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Location,
  SentimentCategory,
  MatrixCell,
  RankedIssue,
  DriftAlert,
  NeedsAttentionItem,
} from "@/types";
import { DRIFT_THRESHOLD } from "@/types";
import { CATEGORIES } from "@/lib/design";

export interface TrendPoint {
  week: string;
  score: number;
}

export interface WeekSummary {
  new_reviews: number;
  best: { category: SentimentCategory; location: string } | null;
  worst: { category: SentimentCategory; location: string } | null;
}

export interface DashboardData {
  hasRealData: boolean;
  locations: Location[];
  matrix: Record<string, Record<SentimentCategory, MatrixCell>>;
  rankedIssues: RankedIssue[];
  loves: RankedIssue[];
  needsAttention: NeedsAttentionItem[];
  recovery: DriftAlert | null;
  week: WeekSummary;
  groupTrend: TrendPoint[];
  trendsByCategory: Record<SentimentCategory, TrendPoint[]>;
}

function emptyMatrix(locations: Location[]): DashboardData["matrix"] {
  const matrix: DashboardData["matrix"] = {};
  for (const loc of locations) {
    matrix[loc.id] = {} as Record<SentimentCategory, MatrixCell>;
    for (const cat of CATEGORIES) matrix[loc.id][cat] = { score: 0, delta: 0, mentions: 0 };
  }
  return matrix;
}

function emptyData(): DashboardData {
  const trendsByCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as TrendPoint[]])
  ) as Record<SentimentCategory, TrendPoint[]>;
  return {
    hasRealData: false,
    locations: [],
    matrix: {},
    rankedIssues: [],
    loves: [],
    needsAttention: [],
    recovery: null,
    week: { new_reviews: 0, best: null, worst: null },
    groupTrend: [],
    trendsByCategory,
  };
}

interface RollupRow {
  location_id: string;
  category: string;
  avg_sentiment_score: number | null;
  sentiment_delta: number | null;
  mention_count: number | null;
  window_end: string;
}

// The most recent row per (location_id, category) for a window — rollups
// accumulate one row per calendar day, so "current" means max(window_end).
async function latestRollups(
  supabase: SupabaseClient,
  locationIds: string[],
  windowDays: 7 | 30 | 90
): Promise<RollupRow[]> {
  if (locationIds.length === 0) return [];
  const { data } = await supabase
    .from("category_rollups")
    .select("location_id, category, avg_sentiment_score, sentiment_delta, mention_count, window_end")
    .eq("window_days", windowDays)
    .in("location_id", locationIds)
    .order("window_end", { ascending: false });

  const seen = new Set<string>();
  const latest: RollupRow[] = [];
  for (const row of (data ?? []) as RollupRow[]) {
    const key = `${row.location_id}:${row.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
  }
  return latest;
}

function buildMatrixFromRollups(locations: Location[], rows: RollupRow[]): DashboardData["matrix"] {
  const matrix = emptyMatrix(locations);
  for (const row of rows) {
    if (!matrix[row.location_id]) continue;
    matrix[row.location_id][row.category as SentimentCategory] = {
      score: row.avg_sentiment_score ?? 0,
      delta: row.sentiment_delta ?? 0,
      mentions: row.mention_count ?? 0,
    };
  }
  return matrix;
}

// Verbatim quotes aren't in rollups — small, targeted live query, capped
// and restricted to non-purged text (30-day verbatim rule).
async function fetchQuotes(
  supabase: SupabaseClient,
  locationId: string,
  category: SentimentCategory,
  limit = 3
): Promise<string[]> {
  const { data } = await supabase
    .from("review_categories")
    .select("reviews!inner(review_text, reviewed_at, location_id)")
    .eq("category", category)
    .eq("reviews.location_id", locationId)
    .not("reviews.review_text", "is", null)
    .limit(20);

  type JoinedReview = { review_text: string | null; reviewed_at: string };
  type Row = { reviews: JoinedReview | JoinedReview[] | null };

  return ((data ?? []) as unknown as Row[])
    .map((r) => (Array.isArray(r.reviews) ? r.reviews[0] : r.reviews))
    .filter((r): r is JoinedReview & { review_text: string } => !!r?.review_text)
    .sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())
    .slice(0, limit)
    .map((r) => r.review_text);
}

async function buildRankedIssuesFromRows(
  supabase: SupabaseClient,
  rows: RollupRow[],
  locationNames: Record<string, string>,
  direction: "negative" | "positive"
): Promise<RankedIssue[]> {
  return Promise.all(
    rows.map(async (r) => {
      const delta = r.sentiment_delta ?? null;
      const severity =
        direction === "negative" && delta !== null
          ? delta <= DRIFT_THRESHOLD.high
            ? "high"
            : delta <= DRIFT_THRESHOLD.medium
            ? "medium"
            : null
          : null;
      const quotes = await fetchQuotes(supabase, r.location_id, r.category as SentimentCategory);
      const issue: RankedIssue = {
        category: r.category as SentimentCategory,
        location_id: r.location_id,
        location_name: locationNames[r.location_id] ?? "Unknown location",
        mention_count: r.mention_count ?? 0,
        avg_sentiment_score: r.avg_sentiment_score ?? 0,
        sentiment_delta: delta,
        severity,
        quotes,
      };
      return issue;
    })
  );
}

async function buildNeedsAttention(supabase: SupabaseClient): Promise<NeedsAttentionItem[]> {
  const { data } = await supabase
    .from("review_analyses")
    .select(
      "id, flag_health_safety, flag_legal, flag_discrimination, flag_physical_safety, reviews!inner(id, star_rating, review_text, reviewed_at, location_id, locations!inner(name))"
    )
    .eq("needs_attention", true)
    .not("reviews.review_text", "is", null)
    .order("analyzed_at", { ascending: false })
    .limit(10);

  type Loc = { name: string };
  type JoinedReview = {
    star_rating: number;
    review_text: string | null;
    reviewed_at: string;
    location_id: string;
    locations: Loc | Loc[] | null;
  };
  type Row = {
    id: string;
    flag_health_safety: boolean;
    flag_legal: boolean;
    flag_discrimination: boolean;
    flag_physical_safety: boolean;
    reviews: JoinedReview | JoinedReview[] | null;
  };

  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const rev = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews;
      if (!rev?.review_text) return null;
      const loc = Array.isArray(rev.locations) ? rev.locations[0] : rev.locations;
      const flag = row.flag_health_safety
        ? "health_safety"
        : row.flag_legal
        ? "legal"
        : row.flag_discrimination
        ? "discrimination"
        : "physical_safety";
      const item: NeedsAttentionItem = {
        id: row.id,
        location_id: rev.location_id,
        location_name: loc?.name ?? "Unknown location",
        flag,
        star_rating: rev.star_rating,
        quote: rev.review_text,
        reviewed_at: rev.reviewed_at,
      };
      return item;
    })
    .filter((x): x is NeedsAttentionItem => x !== null);
}

async function getRecovery(supabase: SupabaseClient): Promise<DriftAlert | null> {
  const { data } = await supabase
    .from("drift_alerts")
    .select("*")
    .eq("resolved", true)
    .not("recovery_score", "is", null)
    .order("recovered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DriftAlert) ?? null;
}

async function getWeekReviewCount(supabase: SupabaseClient, locationIds: string[]): Promise<number> {
  if (locationIds.length === 0) return 0;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .in("location_id", locationIds)
    .gte("reviewed_at", weekAgo.toISOString());
  return count ?? 0;
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function aggregateByWeek(
  rows: { window_end: string; avg_sentiment_score: number | null; mention_count: number | null }[]
): TrendPoint[] {
  const byWeek = new Map<string, { totalScore: number; totalMentions: number }>();
  for (const row of rows) {
    const entry = byWeek.get(row.window_end) ?? { totalScore: 0, totalMentions: 0 };
    const mentions = row.mention_count ?? 0;
    entry.totalScore += (row.avg_sentiment_score ?? 0) * mentions;
    entry.totalMentions += mentions;
    byWeek.set(row.window_end, entry);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekEnd, { totalScore, totalMentions }]) => ({
      week: formatWeekLabel(weekEnd),
      score: totalMentions > 0 ? Math.round((totalScore / totalMentions) * 100) / 100 : 0,
    }));
}

function buildWeekSummary(
  rollups7: { location_id: string; category: string; avg_sentiment_score: number | null }[],
  reviewCount: number,
  locationNames: Record<string, string>
): WeekSummary {
  let bestRow: (typeof rollups7)[number] | null = null;
  let worstRow: (typeof rollups7)[number] | null = null;
  for (const r of rollups7) {
    const score = r.avg_sentiment_score ?? 0;
    if (!bestRow || score > (bestRow.avg_sentiment_score ?? 0)) bestRow = r;
    if (!worstRow || score < (worstRow.avg_sentiment_score ?? 0)) worstRow = r;
  }
  return {
    new_reviews: reviewCount,
    best: bestRow
      ? { category: bestRow.category as SentimentCategory, location: locationNames[bestRow.location_id] ?? "" }
      : null,
    worst: worstRow
      ? { category: worstRow.category as SentimentCategory, location: locationNames[worstRow.location_id] ?? "" }
      : null,
  };
}

export async function getDashboardData(supabase: SupabaseClient): Promise<DashboardData> {
  const { data: locationsData } = await supabase.from("locations").select("*").order("name");
  const locations = (locationsData ?? []) as Location[];

  if (locations.length === 0) return emptyData();

  const locationIds = locations.map((l) => l.id);
  const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  const [rollups90, rollups30, rollups7Res, needsAttention, recovery, weekReviewCount] = await Promise.all([
    latestRollups(supabase, locationIds, 90),
    latestRollups(supabase, locationIds, 30),
    supabase
      .from("category_rollups")
      .select("window_end, category, avg_sentiment_score, sentiment_delta, mention_count, location_id")
      .eq("window_days", 7)
      .in("location_id", locationIds)
      .order("window_end", { ascending: true }),
    buildNeedsAttention(supabase),
    getRecovery(supabase),
    getWeekReviewCount(supabase, locationIds),
  ]);

  const matrix = buildMatrixFromRollups(locations, rollups90);
  const rollups7 = rollups7Res.data ?? [];

  const issuesRows = rollups30
    .filter((r) => (r.avg_sentiment_score ?? 0) < 0)
    .sort((a, b) => (a.avg_sentiment_score ?? 0) - (b.avg_sentiment_score ?? 0))
    .slice(0, 8);
  const lovesRows = rollups30
    .filter((r) => (r.avg_sentiment_score ?? 0) > 0)
    .sort((a, b) => (b.mention_count ?? 0) - (a.mention_count ?? 0))
    .slice(0, 8);

  const [rankedIssues, loves] = await Promise.all([
    buildRankedIssuesFromRows(supabase, issuesRows, locationNames, "negative"),
    buildRankedIssuesFromRows(supabase, lovesRows, locationNames, "positive"),
  ]);

  const week = buildWeekSummary(rollups7, weekReviewCount, locationNames);
  const groupTrend = aggregateByWeek(rollups7);
  const trendsByCategory = Object.fromEntries(
    CATEGORIES.map((cat) => [cat, aggregateByWeek(rollups7.filter((r) => r.category === cat))])
  ) as Record<SentimentCategory, TrendPoint[]>;

  return {
    hasRealData: true,
    locations,
    matrix,
    rankedIssues,
    loves,
    needsAttention,
    recovery,
    week,
    groupTrend,
    trendsByCategory,
  };
}
