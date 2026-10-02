import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_IMPORT_WINDOW_DAYS, importCutoffMs, selectWindowReviews } from "../src/lib/reviews/import-window.ts";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();
const cutoff = importCutoffMs(NOW);

test("the window is 90 days", () => {
  assert.equal(REVIEW_IMPORT_WINDOW_DAYS, 90);
  assert.equal(NOW - cutoff, 90 * DAY);
});

test("a page entirely inside the window is kept and paging continues", () => {
  const page = [{ createTime: daysAgo(1), updateTime: daysAgo(1) }, { createTime: daysAgo(30), updateTime: daysAgo(30) }];
  const { keep, reachedCutoff } = selectWindowReviews(page, cutoff);
  assert.equal(keep.length, 2);
  assert.equal(reachedCutoff, false);
});

test("a page that crosses the cutoff keeps the recent ones and stops paging", () => {
  const page = [{ createTime: daysAgo(10), updateTime: daysAgo(10) }, { createTime: daysAgo(120), updateTime: daysAgo(120) }];
  const { keep, reachedCutoff } = selectWindowReviews(page, cutoff);
  assert.deepEqual(keep, [page[0]]);
  assert.equal(reachedCutoff, true);
});

test("an old review edited recently isn't imported, and doesn't stop paging", () => {
  // Written 2 years ago, edited last week: sorts near the top by updateTime.
  const page = [{ createTime: daysAgo(730), updateTime: daysAgo(7) }, { createTime: daysAgo(20), updateTime: daysAgo(20) }];
  const { keep, reachedCutoff } = selectWindowReviews(page, cutoff);
  assert.deepEqual(keep, [page[1]]);
  assert.equal(reachedCutoff, false);
});

test("a review without updateTime falls back to createTime", () => {
  const { keep, reachedCutoff } = selectWindowReviews([{ createTime: daysAgo(200) }], cutoff);
  assert.equal(keep.length, 0);
  assert.equal(reachedCutoff, true);
});
