import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClientEventType,
  parseFeedbackInput,
  redactSecrets,
  safeErrorMessage,
  sanitizeEventMetadata,
} from "../src/lib/telemetry/sanitize.ts";

test("22. event metadata keeps only allowlisted short fields — no tokens, objects or query strings", () => {
  const out = sanitizeEventMetadata({
    path: "/dashboard/settings?code=abc123&token=zzz",
    tab: "reviews",
    access_token: "ya29.secret",
    password: "hunter2",
    nested: { a: 1 },
    count: 3,
    category: "x".repeat(500),
  });
  assert.deepEqual(Object.keys(out).sort(), ["category", "count", "path", "tab"]);
  assert.equal(out.path, "/dashboard/settings");
  assert.equal((out.category as string).length, 120);
  assert.deepEqual(sanitizeEventMetadata(["a"]), {});
  assert.deepEqual(sanitizeEventMetadata(null), {});
});

test("22. credentials are scrubbed from free text before it's stored", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
  const s = redactSecrets(
    `Bearer abc.def.ghi failed; jwt ${jwt}; google ya29.a0AfH6SMBxyz refresh 1//0gAbCdEfGhIjKlMnOpQrStUv ` +
      `{"access_token":"tok123","refresh_token":"r456"} password=hunter2 key sk-ant-api03-xyz client_secret: shh`
  );
  for (const secret of ["abc.def.ghi", jwt, "ya29.a0AfH6SMBxyz", "1//0gAbCdEfGhIjKlMnOpQrStUv", "tok123", "r456", "hunter2", "sk-ant-api03-xyz", "shh"]) {
    assert.ok(!s.includes(secret), `leaked ${secret}: ${s}`);
  }
});

test("error messages: first line only (no stack), scrubbed, bounded", () => {
  const err = new Error("GBP API error 401: access_token=ya29.zzz\n    at foo (bar.ts:1:1)");
  const msg = safeErrorMessage(err);
  assert.ok(!msg.includes("at foo"));
  assert.ok(!msg.includes("ya29.zzz"));
  assert.ok(safeErrorMessage("x".repeat(2000)).length <= 500);
});

test("the browser can only report client events — never server ones like signup or google_connected", () => {
  assert.equal(isClientEventType("page_viewed"), true);
  assert.equal(isClientEventType("login"), true);
  for (const t of ["signup", "google_connected", "feedback_submitted", "team_member_removed", "drop table", 5, null]) {
    assert.equal(isClientEventType(t), false, String(t));
  }
});

test("12–13. feedback: bug and suggestion are accepted; identity fields in the body are ignored", () => {
  const bug = parseFeedbackInput({ type: "bug", subject: " Heatmap empty ", message: "Tampa shows nothing", rating: 2, route: "/dashboard?x=1", tenant_id: "evil", user_id: "evil", status: "resolved" });
  assert.ok(bug.ok);
  if (bug.ok) {
    assert.deepEqual(bug.value, { type: "bug", subject: "Heatmap empty", message: "Tampa shows nothing", rating: 2, route: "/dashboard", locationId: null });
    assert.ok(!("tenant_id" in bug.value) && !("status" in bug.value));
  }
  assert.ok(parseFeedbackInput({ type: "improvement", subject: "Idea", message: "Export to CSV" }).ok);
});

test("feedback validation errors", () => {
  assert.equal(parseFeedbackInput({ type: "spam", subject: "a", message: "b" }).ok, false);
  assert.equal(parseFeedbackInput({ type: "bug", subject: "", message: "b" }).ok, false);
  assert.equal(parseFeedbackInput({ type: "bug", subject: "a", message: "" }).ok, false);
  assert.equal(parseFeedbackInput({ type: "bug", subject: "a".repeat(201), message: "b" }).ok, false);
  assert.equal(parseFeedbackInput({ type: "bug", subject: "a", message: "b", rating: 6 }).ok, false);
  assert.equal(parseFeedbackInput({ type: "bug", subject: "a", message: "b", rating: 3.5 }).ok, false);
  const r = parseFeedbackInput({ type: "bug", subject: "a", message: "b", route: "https://evil.com", locationId: "not-a-uuid" });
  assert.ok(r.ok && r.value.route === null && r.value.locationId === null);
});
