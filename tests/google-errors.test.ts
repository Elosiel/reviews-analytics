import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_PROFILE_SCOPE,
  GbpApiError,
  GoogleReauthError,
  describeGoogleError,
  hasBusinessProfileScope,
  oauthCallbackErrorMessage,
} from "../src/lib/google/errors.ts";

// Body shapes Google actually returns for these statuses.
const FIXTURES = {
  401: '{"error":{"code":401,"message":"Request had invalid authentication credentials.","status":"UNAUTHENTICATED"}}',
  403: '{"error":{"code":403,"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}',
  429: '{"error":{"code":429,"message":"Quota exceeded for quota metric","status":"RESOURCE_EXHAUSTED"}}',
  500: '{"error":{"code":500,"message":"Internal error encountered.","status":"INTERNAL"}}',
};

test("GbpApiError keeps the status in the message (the 429 backoff matches on it)", () => {
  const err = new GbpApiError(429, FIXTURES[429]);
  assert.equal(err.status, 429);
  assert.ok(err.message.includes("429"));
});

test("401 and a failed token refresh both ask the user to reconnect", () => {
  assert.equal(describeGoogleError(new GbpApiError(401, FIXTURES[401])).kind, "reconnect");
  assert.equal(describeGoogleError(new GoogleReauthError("refresh failed")).kind, "reconnect");
});

test("403 is a permission problem, 429 is rate limiting", () => {
  assert.equal(describeGoogleError(new GbpApiError(403, FIXTURES[403])).kind, "permission");
  assert.equal(describeGoogleError(new GbpApiError(429, FIXTURES[429])).kind, "rate_limited");
});

test("server errors and unknown failures are 'unavailable' and never leak raw Google JSON", () => {
  for (const err of [new GbpApiError(500, FIXTURES[500]), new Error("socket hang up"), "weird"]) {
    const info = describeGoogleError(err);
    assert.equal(info.kind, "unavailable");
    assert.ok(!info.message.includes("{"));
  }
});

test("scope check requires business.manage, not just sign-in scopes", () => {
  assert.equal(hasBusinessProfileScope(`openid email profile ${BUSINESS_PROFILE_SCOPE}`), true);
  assert.equal(hasBusinessProfileScope("openid email profile"), false);
  assert.equal(hasBusinessProfileScope(`${BUSINESS_PROFILE_SCOPE}.extra`), false);
  assert.equal(hasBusinessProfileScope(""), false);
  assert.equal(hasBusinessProfileScope(undefined), false);
});

test("callback error codes map to distinct, non-success messages", () => {
  const denied = oauthCallbackErrorMessage("access_denied");
  const scope = oauthCallbackErrorMessage("insufficient_scope");
  const state = oauthCallbackErrorMessage("invalid_state");
  const other = oauthCallbackErrorMessage("token_exchange_failed");
  assert.equal(new Set([denied, scope, state, other]).size, 4);
  assert.ok(denied.includes("nothing changed"));
  // An unrecognized code (e.g. from a crafted URL) gets the generic message, not an echo.
  assert.equal(oauthCallbackErrorMessage("<script>"), other);
});
