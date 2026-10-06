import { test } from "node:test";
import assert from "node:assert/strict";
import { hashInviteToken, newInviteToken } from "../src/lib/team/invite-token.ts";
import {
  acceptInviteMessage,
  inviteLinkStatus,
  isValidEmail,
  normalizeEmail,
  restaurantDisplayName,
  safeNextPath,
} from "../src/lib/team/invite-shared.ts";

test("restaurant name comes from the shared prefix of location names", () => {
  assert.equal(
    restaurantDisplayName([
      "Terra Gaucha Brazilian Steakhouse - Tampa",
      "Terra Gaucha Brazilian Steakhouse - Omaha",
      "Terra Gaucha Brazilian Steakhouse - Rockville",
    ]),
    "Terra Gaucha Brazilian Steakhouse"
  );
  assert.equal(restaurantDisplayName(["Joe's Diner"]), "Joe's Diner");
  assert.equal(restaurantDisplayName(["Alpha Grill", "Beta Bistro"]), "Alpha Grill and 1 more");
  assert.equal(restaurantDisplayName([]), "your restaurant");
});

test("tokens are long, URL-safe, and unique", () => {
  const a = newInviteToken();
  const b = newInviteToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

test("the stored hash is stable and never the token itself", () => {
  const t = newInviteToken();
  assert.equal(hashInviteToken(t), hashInviteToken(t));
  assert.notEqual(hashInviteToken(t), t);
  assert.match(hashInviteToken(t), /^[0-9a-f]{64}$/);
});

test("emails are normalized and validated", () => {
  assert.equal(normalizeEmail("  Stephanie@TerraGaucha.com "), "stephanie@terragaucha.com");
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a b@c.com"), false);
});

test("post-login redirect only allows same-site paths", () => {
  assert.equal(safeNextPath("/invite/abc"), "/invite/abc");
  assert.equal(safeNextPath("https://evil.com"), null);
  assert.equal(safeNextPath("//evil.com/x"), null);
  assert.equal(safeNextPath("/\\evil.com"), null);
  assert.equal(safeNextPath(""), null);
  assert.equal(safeNextPath(null), null);
});

test("every accept outcome has a human message; unknown ones get the generic one", () => {
  for (const r of ["joined", "used", "expired", "wrong_email", "email_unconfirmed", "has_own_account", "invalid"]) {
    assert.ok(acceptInviteMessage(r).length > 10);
  }
  assert.equal(acceptInviteMessage("weird"), acceptInviteMessage("invalid"));
});

test("invite link status: missing, used, expired, ready", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  assert.equal(inviteLinkStatus(null, now), "invalid");
  assert.equal(inviteLinkStatus({ accepted_at: "2026-10-05T00:00:00Z", expires_at: "2026-10-20T00:00:00Z" }, now), "used");
  assert.equal(inviteLinkStatus({ accepted_at: null, expires_at: "2026-10-01T00:00:00Z" }, now), "expired");
  assert.equal(inviteLinkStatus({ accepted_at: null, expires_at: "2026-10-20T00:00:00Z" }, now), "ready");
});
