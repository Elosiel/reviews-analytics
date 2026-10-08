import { test } from "node:test";
import assert from "node:assert/strict";
import { customerHealth, toCsv, trialState } from "../src/lib/admin/health.ts";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const DAY = 864e5;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const base = {
  locationCount: 2,
  brokenLocationCount: 0,
  lastActivityAt: iso(DAY),
  createdAt: iso(10 * DAY),
  trialEndsAt: new Date(NOW + 20 * DAY).toISOString(),
  paid: false,
  openBugs: 0,
};

test("healthy when active, connected, on trial with time left", () => {
  assert.deepEqual(customerHealth(base, NOW), { status: "healthy", reasons: [] });
});

test("rules, in priority order, each with a reason", () => {
  assert.equal(customerHealth({ ...base, brokenLocationCount: 1, openBugs: 2 }, NOW).status, "connection_issue");
  const attention = customerHealth({ ...base, openBugs: 1 }, NOW);
  assert.equal(attention.status, "needs_attention");
  assert.match(attention.reasons[0], /1 open bug/);
  assert.equal(customerHealth({ ...base, trialEndsAt: iso(DAY) }, NOW).status, "needs_attention");
  assert.equal(customerHealth({ ...base, locationCount: 0 }, NOW).status, "onboarding");
  assert.equal(customerHealth({ ...base, trialEndsAt: new Date(NOW + 3 * DAY).toISOString() }, NOW).status, "trial_expiring");
  assert.equal(customerHealth({ ...base, lastActivityAt: iso(20 * DAY) }, NOW).status, "inactive");
  assert.equal(customerHealth({ ...base, lastActivityAt: null }, NOW).status, "inactive");
  assert.equal(customerHealth({ ...base, lastActivityAt: iso(9 * DAY) }, NOW).status, "low_activity");
});

test("paid accounts never show trial problems", () => {
  assert.equal(customerHealth({ ...base, paid: true, trialEndsAt: iso(DAY) }, NOW).status, "healthy");
  assert.equal(trialState(iso(DAY), true, NOW), "paid");
});

test("19–21. trial state from the persisted end (Tampa's 6 months vs 30 days)", () => {
  // Tampa account: location extension to Apr 5, 2027 is the latest end.
  assert.equal(trialState("2027-04-05T21:51:59.413Z", false, Date.parse("2026-10-08T00:00:00Z")), "active");
  assert.equal(trialState("2027-04-05T21:51:59.413Z", false, Date.parse("2027-04-01T00:00:00Z")), "expiring");
  assert.equal(trialState("2027-04-05T21:51:59.413Z", false, Date.parse("2027-04-05T21:51:59.413Z")), "expired");
  // A normal account: signup + 30 days.
  assert.equal(trialState("2026-11-04T21:51:59.413Z", false, Date.parse("2026-11-04T21:51:59.413Z")), "expired");
  assert.equal(trialState(null, false, NOW), "none");
});

test("CSV export quotes properly and defuses spreadsheet formulas", () => {
  const csv = toCsv(
    [
      { a: "=HYPERLINK(\"http://evil\")", b: 'say "hi", ok', c: ["x", "y"], d: null },
      { a: "+1", b: "-2", c: "@cmd", d: 5 },
    ],
    [
      { key: "a", header: "A" },
      { key: "b", header: "B" },
      { key: "c", header: "C" },
      { key: "d", header: "D" },
    ]
  );
  const [header, row1, row2] = csv.split("\r\n");
  assert.equal(header, "A,B,C,D");
  assert.ok(row1.startsWith(`"'=HYPERLINK(""http://evil"")"`));
  assert.ok(row1.includes(`"say ""hi"", ok"`));
  assert.ok(row1.includes("x; y"));
  assert.equal(row2, "'+1,'-2,'@cmd,5");
});
