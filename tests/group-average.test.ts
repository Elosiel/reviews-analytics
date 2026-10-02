import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionedAverage } from "../src/lib/design.ts";

const empty = { score: 0, mentions: 0 };

test("locations with no mentions don't drag the group average toward 0.00", () => {
  // The reported case: 1 of 8 locations mentioned the category, at +1.00.
  // Dividing by all 8 used to show +0.13.
  const cells = [{ score: 1, mentions: 1 }, ...Array(7).fill(empty)];
  assert.equal(mentionedAverage(cells), 1);
});

test("averages only the locations that were mentioned", () => {
  const avg = mentionedAverage([{ score: 0.6, mentions: 10 }, { score: -0.2, mentions: 3 }, empty]);
  assert.ok(avg !== null && Math.abs(avg - 0.2) < 1e-9);
});

test("no mentions anywhere is null (shown as —), not a fake 0.00", () => {
  assert.equal(mentionedAverage([empty, empty]), null);
  assert.equal(mentionedAverage([]), null);
});
