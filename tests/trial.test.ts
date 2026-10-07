import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarMonths,
  isTrialActive,
  locationTrial,
  standardTrialEndsAt,
  type AccountTrial,
  type TrialExtension,
} from "../src/lib/billing/trial.ts";

const DAY = 24 * 60 * 60 * 1000;

// Mirrors the live rows created by supabase/migrations/20261007_trials.sql.
const TAMPA_ACCOUNT = "91c2934b-5c9d-47e1-8d64-6070f310c77a";
const TAMPA_GBP = "locations/11387573164314683712";
const TAMPA_SIGNUP = "2026-10-05T21:51:59.413Z";

const account = (tenantId: string, startedAt: string): AccountTrial => ({
  tenantId,
  trialStartedAt: startedAt,
  trialEndsAt: standardTrialEndsAt(startedAt),
});
const tampaAccount = account(TAMPA_ACCOUNT, TAMPA_SIGNUP);
const extensions: TrialExtension[] = [
  { tenantId: TAMPA_ACCOUNT, googleLocationId: TAMPA_GBP, trialEndsAt: addCalendarMonths(TAMPA_SIGNUP, 6) },
];
const tampa = { tenant_id: TAMPA_ACCOUNT, google_location_id: TAMPA_GBP };
const at = (startIso: string, ms: number) => Date.parse(startIso) + ms;

test("6 months is calendar months, not 180 days", () => {
  assert.equal(addCalendarMonths("2026-10-06T00:00:00.000Z", 6), "2027-04-06T00:00:00.000Z");
  assert.equal(addCalendarMonths(TAMPA_SIGNUP, 6), "2027-04-05T21:51:59.413Z");
  // Clamps like Postgres when the target month is shorter.
  assert.equal(addCalendarMonths("2026-08-31T10:00:00.000Z", 6), "2027-02-28T10:00:00.000Z");
  assert.equal(addCalendarMonths("2027-08-31T10:00:00.000Z", 6), "2028-02-29T10:00:00.000Z");
});

test("1. a normal restaurant gets exactly 30 days", () => {
  const a = account("normal", "2026-10-06T12:00:00.000Z");
  assert.equal(a.trialEndsAt, "2026-11-05T12:00:00.000Z");
  const t = locationTrial({ tenant_id: "normal", google_location_id: "locations/1" }, a, extensions);
  assert.equal(t.source, "account");
  assert.equal(t.trialEndsAt, "2026-11-05T12:00:00.000Z");
});

test("2. Terra Gaucha Tampa gets 6 months from its original signup", () => {
  const t = locationTrial(tampa, tampaAccount, extensions);
  assert.equal(t.source, "extension");
  assert.equal(t.trialEndsAt, "2027-04-05T21:51:59.413Z");
});

test("3–4. other Terra Gaucha locations (any account) get 30 days", () => {
  for (const gbp of ["ChIJ2S-WA3m15YgRziYDXRtoulo", "ChIJ3e8VDXmhwokRubaR94XLAoI", "locations/999"]) {
    const a = account("another-tg-account", TAMPA_SIGNUP);
    const t = locationTrial({ tenant_id: "another-tg-account", google_location_id: gbp }, a, extensions);
    assert.equal(t.source, "account");
    assert.equal(t.trialEndsAt, "2026-11-04T21:51:59.413Z");
  }
  // Even Tampa's own GBP location, when connected by a different account.
  const other = account("someone-else", TAMPA_SIGNUP);
  assert.equal(locationTrial({ tenant_id: "someone-else", google_location_id: TAMPA_GBP }, other, extensions).source, "account");
});

test("5–6. Tampa is still active at 31 days and at 5 months", () => {
  assert.equal(locationTrial(tampa, tampaAccount, extensions, at(TAMPA_SIGNUP, 31 * DAY)).active, true);
  const fiveMonths = Date.parse(addCalendarMonths(TAMPA_SIGNUP, 5));
  assert.equal(locationTrial(tampa, tampaAccount, extensions, fiveMonths).active, true);
});

test("7. Tampa expires exactly at its 6-month timestamp (not permanently exempt)", () => {
  const end = Date.parse("2027-04-05T21:51:59.413Z");
  assert.equal(locationTrial(tampa, tampaAccount, extensions, end - 1).active, true);
  assert.equal(locationTrial(tampa, tampaAccount, extensions, end).active, false);
  assert.equal(locationTrial(tampa, tampaAccount, extensions, end + 365 * DAY).active, false);
});

test("8. a normal account expires exactly at 30 days", () => {
  const a = account("normal", "2026-10-06T12:00:00.000Z");
  const loc = { tenant_id: "normal", google_location_id: "locations/1" };
  assert.equal(locationTrial(loc, a, [], at(a.trialStartedAt, 30 * DAY) - 1).active, true);
  assert.equal(locationTrial(loc, a, [], at(a.trialStartedAt, 30 * DAY)).active, false);
});

test("9. a location Tampa's account adds later keeps the account's 30 days (no reset, no 6 months)", () => {
  // Added on day 20 — the trial still ends at the original signup + 30 days.
  const added = { tenant_id: TAMPA_ACCOUNT, google_location_id: "locations/jacksonville" };
  const t = locationTrial(added, tampaAccount, extensions, at(TAMPA_SIGNUP, 20 * DAY));
  assert.equal(t.source, "account");
  assert.equal(t.trialEndsAt, "2026-11-04T21:51:59.413Z");
  assert.equal(locationTrial(added, tampaAccount, extensions, at(TAMPA_SIGNUP, 31 * DAY)).active, false);
});

test("10. renaming a restaurant to 'Terra Gaucha Tampa' changes nothing", () => {
  const renamed = { tenant_id: "normal", google_location_id: "locations/1", name: "Terra Gaucha Tampa" };
  const a = account("normal", "2026-10-06T12:00:00.000Z");
  const t = locationTrial(renamed, a, extensions);
  assert.equal(t.source, "account");
  assert.equal(t.trialEndsAt, "2026-11-05T12:00:00.000Z");
});

test("an extension never shortens the account trial", () => {
  const short: TrialExtension[] = [{ tenantId: "normal", googleLocationId: "locations/1", trialEndsAt: "2026-10-10T00:00:00.000Z" }];
  const a = account("normal", "2026-10-06T12:00:00.000Z");
  assert.equal(locationTrial({ tenant_id: "normal", google_location_id: "locations/1" }, a, short).trialEndsAt, a.trialEndsAt);
});

test("isTrialActive is strict at the boundary", () => {
  assert.equal(isTrialActive("2026-11-05T12:00:00.000Z", Date.parse("2026-11-05T11:59:59.999Z")), true);
  assert.equal(isTrialActive("2026-11-05T12:00:00.000Z", Date.parse("2026-11-05T12:00:00.000Z")), false);
});
