/**
 * How far back review sync reaches. Rankings, trends, and the heatmap only
 * cover the last 90 days (the widest rollup window), so older reviews would
 * cost an AI analysis each and a slower sync without changing any ranking.
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

export const REVIEW_IMPORT_WINDOW_DAYS = 90;

export function importCutoffMs(now: number = Date.now()): number {
  return now - REVIEW_IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

interface GoogleReviewTimes {
  createTime: string;
  updateTime?: string;
}

/**
 * Splits one page of Google reviews (requested newest-updated first) into
 * the ones to import and whether paging can stop. A review is imported when
 * it was written inside the window. Paging stops at the first review last
 * updated before the cutoff: every later one was updated — and so written —
 * earlier still.
 */
export function selectWindowReviews<T extends GoogleReviewTimes>(
  reviews: T[],
  cutoffMs: number
): { keep: T[]; reachedCutoff: boolean } {
  return {
    keep: reviews.filter((r) => Date.parse(r.createTime) >= cutoffMs),
    reachedCutoff: reviews.some((r) => Date.parse(r.updateTime ?? r.createTime) < cutoffMs),
  };
}
