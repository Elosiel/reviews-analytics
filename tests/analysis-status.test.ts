import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STALL_AFTER_MS,
  deriveAnalysisState,
  type AnalysisCounts,
} from "../src/lib/data/analysis-status.ts";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const counts = (overrides: Partial<AnalysisCounts>): AnalysisCounts => ({
  totalReviews: 120,
  textReviews: 100,
  analyzedTextReviews: 100,
  recentTextReviews: 40,
  hasRollups: true,
  everSynced: true,
  lastAnalyzedAt: ago(60_000),
  lastIngestedAt: ago(120_000),
  ...overrides,
});

const kind = (c: Partial<AnalysisCounts>) => deriveAnalysisState(counts(c), NOW).kind;

test("no reviews: 'not imported' before any sync, 'no reviews' after one", () => {
  const empty = { totalReviews: 0, textReviews: 0, analyzedTextReviews: 0, hasRollups: false };
  assert.equal(kind({ ...empty, everSynced: false }), "not_imported");
  assert.equal(kind({ ...empty, everSynced: true }), "no_reviews");
});

test("pending reviews with recent activity are 'analyzing', with real progress numbers", () => {
  const state = deriveAnalysisState(counts({ analyzedTextReviews: 38, hasRollups: false }), NOW);
  assert.equal(state.kind, "analyzing");
  assert.equal(state.analyzed, 38);
  assert.equal(state.analyzable, 100);
});

test("pending reviews with no activity past the stall window are 'stalled'", () => {
  const stale = ago(STALL_AFTER_MS + 1);
  assert.equal(kind({ analyzedTextReviews: 38, lastAnalyzedAt: stale, lastIngestedAt: stale }), "stalled");
  assert.equal(kind({ analyzedTextReviews: 0, lastAnalyzedAt: null, lastIngestedAt: stale }), "stalled");
  // A fresh import counts as activity even before the first analysis lands.
  assert.equal(kind({ analyzedTextReviews: 0, lastAnalyzedAt: null, lastIngestedAt: ago(5_000) }), "analyzing");
});

test("fully analyzed with rollups is 'ready'", () => {
  assert.equal(kind({}), "ready");
});

test("fully analyzed, no rollups yet: 'finishing' right after analysis, otherwise nothing to rank", () => {
  assert.equal(kind({ hasRollups: false }), "finishing");
  assert.equal(kind({ hasRollups: false, lastAnalyzedAt: ago(STALL_AFTER_MS + 1) }), "nothing_to_rank");
  assert.equal(kind({ hasRollups: false, recentTextReviews: 0 }), "nothing_to_rank");
});

test("star-only reviews (no text) never block the state", () => {
  const starOnly = { totalReviews: 12, textReviews: 0, analyzedTextReviews: 0, recentTextReviews: 0, hasRollups: false };
  assert.equal(kind(starOnly), "nothing_to_rank");
});

test("progress never reports more analyzed than analyzable", () => {
  // Text purged after analysis can leave the analyzed count above the text count.
  const state = deriveAnalysisState(counts({ textReviews: 10, analyzedTextReviews: 12 }), NOW);
  assert.equal(state.analyzed, 10);
});
