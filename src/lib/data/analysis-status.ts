/**
 * Where a connected account's reviews are in the import → analysis →
 * rollup pipeline, so the dashboard can say so honestly instead of
 * rendering empty widgets that read as "nothing to report".
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

export interface AnalysisCounts {
  totalReviews: number;
  /** Reviews that still have text — only these can be analyzed. */
  textReviews: number;
  analyzedTextReviews: number;
  /** Reviews with text from the last 90 days — the widest rollup window. */
  recentTextReviews: number;
  hasRollups: boolean;
  /** Any location has completed at least one review sync. */
  everSynced: boolean;
  lastAnalyzedAt: string | null;
  lastIngestedAt: string | null;
}

export type AnalysisStateKind =
  | "not_imported"
  | "no_reviews"
  | "analyzing"
  | "stalled"
  | "finishing"
  | "nothing_to_rank"
  | "ready";

export interface AnalysisState {
  kind: AnalysisStateKind;
  analyzed: number;
  analyzable: number;
  totalReviews: number;
}

// Analysis runs in batches of 10, each chaining the next within seconds.
// No progress for this long means the chain broke; the 6-hourly
// reconciliation poll would restart it, but the owner shouldn't wait.
export const STALL_AFTER_MS = 10 * 60 * 1000;

function msSince(iso: string | null, now: number): number {
  return iso ? now - new Date(iso).getTime() : Infinity;
}

export function deriveAnalysisState(c: AnalysisCounts, now: number = Date.now()): AnalysisState {
  const base = {
    analyzed: Math.min(c.analyzedTextReviews, c.textReviews),
    analyzable: c.textReviews,
    totalReviews: c.totalReviews,
  };

  if (c.totalReviews === 0) {
    return { ...base, kind: c.everSynced ? "no_reviews" : "not_imported" };
  }

  const lastActivityMs = Math.min(msSince(c.lastAnalyzedAt, now), msSince(c.lastIngestedAt, now));

  if (c.textReviews > c.analyzedTextReviews) {
    return { ...base, kind: lastActivityMs > STALL_AFTER_MS ? "stalled" : "analyzing" };
  }

  if (c.hasRollups) return { ...base, kind: "ready" };

  // Everything analyzed but no rollup yet: either the rollup job is still
  // running (it fires after each analysis batch), or there's genuinely
  // nothing in the last 90 days to rank.
  if (c.recentTextReviews > 0 && msSince(c.lastAnalyzedAt, now) <= STALL_AFTER_MS) {
    return { ...base, kind: "finishing" };
  }
  return { ...base, kind: "nothing_to_rank" };
}
