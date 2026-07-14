/**
 * POST /api/reports/generate
 *
 * Builds the weekly health-of-the-business report: last 7 days vs the
 * prior 7 days by default. Manager-triggered only (the "Generate weekly
 * report" button) — no scheduled/automatic sending in v1, same pattern
 * as meetings/SOPs.
 *
 * All numbers (mention counts, composite scores, ranks, trends) are
 * computed here directly from review_categories/reviews for the exact
 * period boundaries — same live-join approach as /api/meetings/generate,
 * since the dashboard's category_rollups pre-aggregation doesn't carry
 * arbitrary custom windows. Claude (or the deterministic fallback when
 * ANTHROPIC_API_KEY isn't configured) only writes the narrative around
 * numbers already computed — it never invents a theme or trend.
 *
 * Verbatim quotes are snapshotted into report_quote_snapshots with
 * content_purge_at copied from the source review — same 30-day clock
 * as everywhere else.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateWeeklyReportNarrative,
  buildDeterministicWeeklyReportNarrative,
  type ReportSourceLocation,
  type ReportSourceTheme,
} from "@/lib/pipeline/claude";
import type {
  DangerFlag,
  MatrixCell,
  ReportLocationRanking,
  ReportNeedsAttentionItem,
  ReportQuoteSnapshot,
  ReportTheme,
  ReportTrend,
  RestaurantProfile,
  SentimentCategory,
} from "@/types";

const ALL_CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];
const QUOTES_PER_THEME = 3;
const QUOTE_MAX_CHARS = 240;
const THEME_MIN_MENTIONS = 2;   // a single mention isn't a "recurring" pattern
const THEME_SCORE_CUTOFF = 0.15; // how clearly positive/negative a category must lean to count as a theme
const TREND_FLAT_BAND = 0.05;   // |delta| below this reads as "flat", not improving/declining
const MAX_NEEDS_ATTENTION = 10;  // same cap as the dashboard's NeedsAttentionBanner query

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, delta: number): Date {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + delta);
  return nd;
}
function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}
function endOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`;
}
function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function snippet(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= QUOTE_MAX_CHARS) return trimmed;
  const cut = trimmed.slice(0, QUOTE_MAX_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : QUOTE_MAX_CHARS)}…`;
}

interface JoinedReview {
  id: string;
  review_text: string | null;
  star_rating: number;
  reviewed_at: string;
  content_purge_at: string;
  location_id: string;
}
interface CatRow {
  category: SentimentCategory;
  sentiment_score: number;
  reviews: JoinedReview;
}

function compositeScore(rows: { sentiment_score: number }[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((s, r) => s + r.sentiment_score, 0);
  return Math.round((sum / rows.length) * 1000) / 1000;
}

function trendFor(
  currentRows: CatRow[],
  priorRows: CatRow[]
): { trend: ReportTrend; basis: string; compositeScorePrior: number | null } {
  // Too few current-period mentions to say anything real, regardless of
  // whether a prior period exists — don't let a near-empty sample get
  // compared against a real average and read as a confident trend.
  if (currentRows.length < 4) {
    return {
      trend: "flat",
      basis:
        priorRows.length > 0
          ? "not enough reviews this period to compare against the prior period"
          : "not enough reviews this period for a trend signal",
      compositeScorePrior: priorRows.length > 0 ? compositeScore(priorRows) : null,
    };
  }

  if (priorRows.length > 0) {
    const cur = compositeScore(currentRows);
    const prior = compositeScore(priorRows);
    const delta = cur - prior;
    const trend: ReportTrend =
      delta > TREND_FLAT_BAND ? "improving" : delta < -TREND_FLAT_BAND ? "declining" : "flat";
    return { trend, basis: "vs the prior 7-day period", compositeScorePrior: prior };
  }

  // No prior-period data yet — within-period heuristic: split this
  // period's reviews chronologically and compare the recent half against
  // the earlier half. Called out explicitly so nobody reads this as a
  // real week-over-week trend. currentRows.length >= 4 is guaranteed here.
  const sorted = [...currentRows].sort(
    (a, b) => new Date(a.reviews.reviewed_at).getTime() - new Date(b.reviews.reviewed_at).getTime()
  );
  const mid = Math.floor(sorted.length / 2);
  const olderAvg = compositeScore(sorted.slice(0, mid));
  const recentAvg = compositeScore(sorted.slice(mid));
  const delta = recentAvg - olderAvg;
  const trend: ReportTrend =
    delta > TREND_FLAT_BAND ? "improving" : delta < -TREND_FLAT_BAND ? "declining" : "flat";
  return {
    trend,
    basis: "based on earlier vs later reviews this week — not enough history yet for a week-over-week comparison",
    compositeScorePrior: null,
  };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  const tenantId: string | undefined = profileRow?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { data: locationsData } = await supabase
    .from("locations")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");
  const locations = locationsData ?? [];
  if (!locations.length) {
    return NextResponse.json({ error: "Connect at least one location before generating a report" }, { status: 400 });
  }
  const locationIds = locations.map((l) => l.id);
  const locationNames = new Map(locations.map((l) => [l.id, l.name as string]));

  // Default period: last 7 days vs the prior 7 days.
  const today = new Date();
  const periodEnd = isoDate(today);
  const periodStart = isoDate(addDays(today, -6));
  const priorPeriodEnd = isoDate(addDays(today, -7));
  const priorPeriodStart = isoDate(addDays(today, -13));

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, location_id, star_rating, reviewed_at")
    .in("location_id", locationIds)
    .gte("reviewed_at", startOfDayIso(priorPeriodStart))
    .lte("reviewed_at", endOfDayIso(periodEnd));

  const { data: catRowsRaw } = await supabase
    .from("review_categories")
    .select(`
      category,
      sentiment_score,
      reviews!inner(id, review_text, star_rating, reviewed_at, content_purge_at, location_id)
    `)
    .eq("tenant_id", tenantId)
    .in("reviews.location_id", locationIds)
    .gte("reviews.reviewed_at", startOfDayIso(priorPeriodStart))
    .lte("reviews.reviewed_at", endOfDayIso(periodEnd));

  const allCatRows = (catRowsRaw ?? []) as unknown as CatRow[];
  // Compare as epoch millis, not raw strings — PostgREST doesn't guarantee
  // the same timestamp suffix format (+00:00 vs Z) as the boundaries below.
  const periodStartMs = new Date(startOfDayIso(periodStart)).getTime();
  const periodEndMs = new Date(endOfDayIso(periodEnd)).getTime();
  const priorPeriodStartMs = new Date(startOfDayIso(priorPeriodStart)).getTime();
  const priorPeriodEndMs = new Date(endOfDayIso(priorPeriodEnd)).getTime();
  const isCurrentPeriod = (reviewedAt: string) => {
    const t = new Date(reviewedAt).getTime();
    return t >= periodStartMs && t <= periodEndMs;
  };
  const isPriorPeriod = (reviewedAt: string) => {
    const t = new Date(reviewedAt).getTime();
    return t >= priorPeriodStartMs && t <= priorPeriodEndMs;
  };

  const currentCatRows = allCatRows.filter((r) => isCurrentPeriod(r.reviews.reviewed_at));
  const priorCatRows = allCatRows.filter((r) => isPriorPeriod(r.reviews.reviewed_at));

  const currentReviews = (reviewRows ?? []).filter((r) => isCurrentPeriod(r.reviewed_at));
  const priorReviews = (reviewRows ?? []).filter((r) => isPriorPeriod(r.reviewed_at));
  const hasPriorPeriod = priorReviews.length > 0;

  // ── Per-location stats ────────────────────────────────────────────
  const sourceLocations: ReportSourceLocation[] = locations.map((loc) => {
    const locCurrentReviews = currentReviews.filter((r) => r.location_id === loc.id);
    const locCurrentCats = currentCatRows.filter((r) => r.reviews.location_id === loc.id);
    const locPriorCats = priorCatRows.filter((r) => r.reviews.location_id === loc.id);

    const avgRating =
      locCurrentReviews.length > 0
        ? Math.round(
            (locCurrentReviews.reduce((s, r) => s + r.star_rating, 0) / locCurrentReviews.length) * 10
          ) / 10
        : null;

    const { trend, basis, compositeScorePrior } = trendFor(locCurrentCats, locPriorCats);

    const byCategory = new Map<SentimentCategory, CatRow[]>();
    for (const row of locCurrentCats) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }
    const topCategories = Array.from(byCategory.entries())
      .map(([category, rows]) => ({
        category,
        avg_sentiment_score: compositeScore(rows),
        mention_count: rows.length,
      }))
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, 4);

    return {
      location_id: loc.id,
      location_name: loc.name,
      review_count: locCurrentReviews.length,
      avg_rating: avgRating,
      composite_score: compositeScore(locCurrentCats),
      composite_score_prior: compositeScorePrior,
      trend,
      trend_basis: basis,
      top_categories: topCategories,
    };
  });
  sourceLocations.sort((a, b) => b.composite_score - a.composite_score);

  // ── Cross-location category matrix — same 90-day snapshot as the
  // Overview dashboard's heatmap. Read from category_rollups (never a
  // live join) since this is the long-window, cron-computed comparison
  // view — the report's headline numbers above stay in the live-joined
  // 7-day frame; this section is deliberately the broader picture for
  // context, captured at generation time. ─────────────────────────────
  const { data: rollups90Raw } = await supabase
    .from("category_rollups")
    .select("location_id, category, avg_sentiment_score, sentiment_delta, mention_count, window_end")
    .eq("tenant_id", tenantId)
    .eq("window_days", 90)
    .in("location_id", locationIds)
    .order("window_end", { ascending: false });

  interface Rollup90Row {
    location_id: string;
    category: SentimentCategory;
    avg_sentiment_score: number | null;
    sentiment_delta: number | null;
    mention_count: number | null;
    window_end: string;
  }
  // One row per (location, category) — rollups accumulate a row per
  // calendar day, so "current" means the most recent window_end.
  const seenRollup90 = new Set<string>();
  const latestRollups90: Rollup90Row[] = [];
  for (const row of (rollups90Raw ?? []) as Rollup90Row[]) {
    const key = `${row.location_id}:${row.category}`;
    if (seenRollup90.has(key)) continue;
    seenRollup90.add(key);
    latestRollups90.push(row);
  }

  const categoryMatrix: Record<string, Record<SentimentCategory, MatrixCell>> = {};
  for (const loc of locations) {
    categoryMatrix[loc.id] = {} as Record<SentimentCategory, MatrixCell>;
    for (const cat of ALL_CATEGORIES) {
      categoryMatrix[loc.id][cat] = { score: 0, delta: 0, mentions: 0 };
    }
  }
  for (const row of latestRollups90) {
    if (!categoryMatrix[row.location_id]) continue;
    categoryMatrix[row.location_id][row.category] = {
      score: row.avg_sentiment_score ?? 0,
      delta: row.sentiment_delta ?? 0,
      mentions: row.mention_count ?? 0,
    };
  }

  // ── Brand-wide good/bad themes ──────────────────────────────────────
  const byCategoryAll = new Map<SentimentCategory, CatRow[]>();
  for (const row of currentCatRows) {
    const list = byCategoryAll.get(row.category) ?? [];
    list.push(row);
    byCategoryAll.set(row.category, list);
  }

  function themeLocationNames(rows: CatRow[]): string[] {
    const byLoc = new Map<string, number>();
    for (const row of rows) {
      byLoc.set(row.reviews.location_id, (byLoc.get(row.reviews.location_id) ?? 0) + 1);
    }
    return Array.from(byLoc.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => locationNames.get(id) ?? "Unknown location");
  }

  const categoryStats = ALL_CATEGORIES.map((category) => {
    const rows = byCategoryAll.get(category) ?? [];
    return {
      category,
      rows,
      avg_sentiment_score: compositeScore(rows),
      mention_count: rows.length,
    };
  }).filter((c) => c.mention_count >= THEME_MIN_MENTIONS);

  const goodCategoryStats = categoryStats
    .filter((c) => c.avg_sentiment_score >= THEME_SCORE_CUTOFF)
    .sort((a, b) => b.avg_sentiment_score - a.avg_sentiment_score)
    .slice(0, 3);
  const badCategoryStats = categoryStats
    .filter((c) => c.avg_sentiment_score <= -THEME_SCORE_CUTOFF)
    .sort((a, b) => a.avg_sentiment_score - b.avg_sentiment_score)
    .slice(0, 3);

  const goodThemesSource: ReportSourceTheme[] = goodCategoryStats.map((c) => ({
    category: c.category,
    avg_sentiment_score: c.avg_sentiment_score,
    mention_count: c.mention_count,
    location_names: themeLocationNames(c.rows),
  }));
  const badThemesSource: ReportSourceTheme[] = badCategoryStats.map((c) => ({
    category: c.category,
    avg_sentiment_score: c.avg_sentiment_score,
    mention_count: c.mention_count,
    location_names: themeLocationNames(c.rows),
  }));

  // ── Danger flags — surfaced regardless of category (spec rule 6) ────
  // Same query shape as buildNeedsAttention() in lib/data/dashboard.ts:
  // deliberately NOT restricted to the report's 7-day window — a
  // still-live safety/legal flag doesn't stop mattering because it falls
  // outside this week's slice (the quote text itself already ages out via
  // the 30-day purge). Health/safety > legal > discrimination >
  // physical_safety mirrors that same priority order when a single
  // review trips more than one flag.
  const { data: dangerRowsRaw } = await supabase
    .from("review_analyses")
    .select(`
      flag_health_safety, flag_legal, flag_discrimination, flag_physical_safety,
      reviews!inner(id, star_rating, review_text, reviewed_at, content_purge_at, location_id)
    `)
    .eq("needs_attention", true)
    .in("reviews.location_id", locationIds)
    .not("reviews.review_text", "is", null)
    .order("analyzed_at", { ascending: false })
    .limit(MAX_NEEDS_ATTENTION);

  interface DangerRow {
    flag_health_safety: boolean;
    flag_legal: boolean;
    flag_discrimination: boolean;
    flag_physical_safety: boolean;
    reviews: JoinedReview;
  }
  function flagFor(row: DangerRow): DangerFlag {
    if (row.flag_health_safety) return "health_safety";
    if (row.flag_legal) return "legal";
    if (row.flag_discrimination) return "discrimination";
    return "physical_safety";
  }
  const dangerRows = (dangerRowsRaw ?? []) as unknown as DangerRow[];
  const needsAttentionFinal: ReportNeedsAttentionItem[] = dangerRows.map((row) => ({
    review_id: row.reviews.id,
    location_id: row.reviews.location_id,
    location_name: locationNames.get(row.reviews.location_id) ?? "Unknown location",
    flag: flagFor(row),
    star_rating: row.reviews.star_rating,
    reviewed_at: row.reviews.reviewed_at,
  }));

  // ── Restaurant profile context ──────────────────────────────────────
  const { data: profileCtx } = await supabase
    .from("tenant_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const profile: RestaurantProfile = {
    mission: profileCtx?.mission ?? "",
    cuisine_style: profileCtx?.cuisine_style ?? "",
    target_guests: profileCtx?.target_guests ?? "",
    price_point: profileCtx?.price_point ?? "$$",
    goals: profileCtx?.goals ?? "",
    notes: profileCtx?.notes ?? "",
    website_url: profileCtx?.website_url ?? "",
    menu_url: profileCtx?.menu_url ?? "",
  };

  // ── Narrative: Claude if configured, deterministic fallback otherwise
  // (and as a safety net if the Claude call throws) ───────────────────
  let aiGenerated = false;
  let narrative;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      narrative = await generateWeeklyReportNarrative(
        sourceLocations,
        goodThemesSource,
        badThemesSource,
        profile,
        hasPriorPeriod
      );
      aiGenerated = true;
    } catch (err) {
      console.error("Weekly report Claude generation failed, using deterministic fallback:", err);
    }
  }
  if (!narrative) {
    narrative = buildDeterministicWeeklyReportNarrative(
      sourceLocations,
      goodThemesSource,
      badThemesSource,
      hasPriorPeriod
    );
  }

  const goodThemesFinal: ReportTheme[] = goodThemesSource.map((t, i) => ({
    category: t.category,
    theme: narrative!.good_themes[i]?.theme || `${t.category} praised`,
    description: narrative!.good_themes[i]?.description || `Mentioned positively ${t.mention_count} times, avg sentiment ${fmtSigned(t.avg_sentiment_score)}.`,
    mention_count: t.mention_count,
    avg_sentiment_score: t.avg_sentiment_score,
    location_names: t.location_names,
  }));
  const badThemesFinal: ReportTheme[] = badThemesSource.map((t, i) => ({
    category: t.category,
    theme: narrative!.bad_themes[i]?.theme || `${t.category} complaints`,
    description: narrative!.bad_themes[i]?.description || `Flagged negatively ${t.mention_count} times, avg sentiment ${fmtSigned(t.avg_sentiment_score)}.`,
    mention_count: t.mention_count,
    avg_sentiment_score: t.avg_sentiment_score,
    location_names: t.location_names,
  }));
  const locationRankingsFinal: ReportLocationRanking[] = sourceLocations.map((loc, i) => ({
    location_id: loc.location_id,
    location_name: loc.location_name,
    rank: i + 1,
    verdict: narrative!.location_verdicts[i] || `${fmtSigned(loc.composite_score)} composite sentiment, ${loc.trend}.`,
    composite_score: loc.composite_score,
    review_count: loc.review_count,
    avg_rating: loc.avg_rating,
    trend: loc.trend,
    trend_basis: loc.trend_basis,
  }));

  const { data: report, error: reportErr } = await supabase
    .from("weekly_reports")
    .insert({
      tenant_id: tenantId,
      period_start: periodStart,
      period_end: periodEnd,
      prior_period_start: hasPriorPeriod ? priorPeriodStart : null,
      prior_period_end: hasPriorPeriod ? priorPeriodEnd : null,
      has_prior_period: hasPriorPeriod,
      executive_summary: narrative.executive_summary,
      good_themes: goodThemesFinal,
      bad_themes: badThemesFinal,
      location_rankings: locationRankingsFinal,
      recommended_actions: narrative.recommended_actions,
      category_matrix: categoryMatrix,
      needs_attention: needsAttentionFinal,
      ai_generated: aiGenerated,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: reportErr?.message ?? "Failed to create report" }, { status: 500 });
  }

  // ── Snapshot evidence quotes for the themes just saved ──────────────
  // Prefer one quote per distinct location before falling back to a
  // second quote from the same location, so a theme's evidence isn't
  // all from a single review thread.
  function pickDiverseQuotes(rows: CatRow[]): CatRow[] {
    const withText = rows
      .filter((r) => r.reviews.review_text)
      .sort((a, b) => new Date(b.reviews.reviewed_at).getTime() - new Date(a.reviews.reviewed_at).getTime());
    const seen = new Set<string>();
    const firstPerLocation: CatRow[] = [];
    const remainder: CatRow[] = [];
    for (const row of withText) {
      if (!seen.has(row.reviews.location_id)) {
        seen.add(row.reviews.location_id);
        firstPerLocation.push(row);
      } else {
        remainder.push(row);
      }
    }
    return [...firstPerLocation, ...remainder].slice(0, QUOTES_PER_THEME);
  }

  const quoteRows: Omit<ReportQuoteSnapshot, "id">[] = [];
  function collectQuotes(themes: { category: SentimentCategory; rows: CatRow[] }[], kind: "good" | "bad") {
    for (const t of themes) {
      const picked = pickDiverseQuotes(t.rows);
      for (const row of picked) {
        quoteRows.push({
          tenant_id: tenantId as string,
          report_id: report.id,
          theme_kind: kind,
          category: t.category,
          flag: null,
          review_id: row.reviews.id,
          location_id: row.reviews.location_id,
          location_name: locationNames.get(row.reviews.location_id) ?? "Unknown location",
          quote_text: snippet(row.reviews.review_text!),
          star_rating: row.reviews.star_rating,
          reviewed_at: row.reviews.reviewed_at,
          content_purge_at: row.reviews.content_purge_at,
        });
      }
    }
  }
  collectQuotes(goodCategoryStats, "good");
  collectQuotes(badCategoryStats, "bad");

  // Danger-flag quotes — one per flagged review, never trimmed of variety
  // since every one of these deserves a manager's eyes.
  for (const row of dangerRows) {
    quoteRows.push({
      tenant_id: tenantId as string,
      report_id: report.id,
      theme_kind: "danger",
      category: null,
      flag: flagFor(row),
      review_id: row.reviews.id,
      location_id: row.reviews.location_id,
      location_name: locationNames.get(row.reviews.location_id) ?? "Unknown location",
      quote_text: snippet(row.reviews.review_text!),
      star_rating: row.reviews.star_rating,
      reviewed_at: row.reviews.reviewed_at,
      content_purge_at: row.reviews.content_purge_at,
    });
  }

  if (quoteRows.length > 0) {
    await supabase.from("report_quote_snapshots").insert(quoteRows);
  }

  return NextResponse.json({ data: report, error: null });
}
