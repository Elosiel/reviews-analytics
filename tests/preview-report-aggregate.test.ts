import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateRisks, aggregateThemes, shortQuote } from "../src/lib/preview-report/aggregate.ts";

const noFlags = { health_safety: false, legal: false, discrimination: false, physical_safety: false };
const rev = (stars: number, text: string, cats: [string, number][], flags = noFlags) => ({
  star_rating: stars, review_text: text, reviewer_name: "x", reviewed_at: "2026-10-01T00:00:00Z",
  categories: cats.map(([category, sentiment_score]) => ({ category, sentiment_score, confidence: 0.9 })),
  danger_flags: flags,
}) as never;

test("themes count mentions, average sentiment, sort by mentions", () => {
  const t = aggregateThemes([
    rev(2, "slow and cold", [["wait_time", -0.8], ["food", -0.6]]),
    rev(5, "great food", [["food", 0.9]]),
    rev(1, "waited forever", [["wait_time", -1]]),
  ]);
  assert.equal(t.length, 2);
  assert.equal(t[0].category, "wait_time"); // tie on 2 mentions → more negative first
  assert.equal(t[0].mentions, 2);
  assert.equal(t[0].avg_sentiment, -0.9);
  assert.equal(t[1].positive_mentions, 1);
  assert.equal(t[1].negative_mentions, 1);
});

test("risks only include raised flags", () => {
  const r = aggregateRisks([rev(1, "got sick", [], { ...noFlags, health_safety: true }), rev(5, "ok", [])]);
  assert.deepEqual(r.map((x) => [x.flag, x.count]), [["health_safety", 1]]);
});

test("quotes are trimmed", () => {
  assert.ok(shortQuote("a ".repeat(300)).length <= 220);
  assert.equal(shortQuote("  hi\n there "), "hi there");
});

test("empty input", () => {
  assert.deepEqual(aggregateThemes([]), []);
});
