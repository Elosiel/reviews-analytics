import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAdminAccess, roleCan, validImpersonationReason } from "../src/lib/admin/access.ts";

const claims = (aal: string) => ({ sub: "u1", email: "a@b.co", aal, session_id: "s1" });

test("1–2. a normal customer (no admin row) is forbidden — pages and APIs share this rule", () => {
  assert.deepEqual(decideAdminAccess(claims("aal1"), null), { ok: false, reason: "forbidden" });
  assert.deepEqual(decideAdminAccess(claims("aal2"), null), { ok: false, reason: "forbidden" });
});

test("23. no session → unauthenticated (401), never forbidden/ok", () => {
  assert.deepEqual(decideAdminAccess(null, null), { ok: false, reason: "unauthenticated" });
  assert.deepEqual(decideAdminAccess({ sub: "" }, { role: "super_admin", disabled_at: null }), { ok: false, reason: "unauthenticated" });
});

test("3. a super admin needs two-factor (aal2) before getting in", () => {
  const admin = { role: "super_admin", disabled_at: null };
  assert.deepEqual(decideAdminAccess(claims("aal1"), admin), { ok: false, reason: "mfa_required" });
  assert.deepEqual(decideAdminAccess(claims("aal2"), admin), { ok: true, role: "super_admin" });
});

test("disabled or unknown admin roles are forbidden", () => {
  assert.equal(decideAdminAccess(claims("aal2"), { role: "super_admin", disabled_at: "2026-10-01T00:00:00Z" }).ok, false);
  assert.equal(decideAdminAccess(claims("aal2"), { role: "operator", disabled_at: null }).ok, false);
  assert.equal(decideAdminAccess(claims("aal2"), { role: "owner", disabled_at: null }).ok, false);
});

test("role capabilities: super admin can do everything; reserved roles are narrower", () => {
  for (const cap of ["view", "export", "manage_users", "impersonate", "manage_feedback", "manage_notes", "manage_trials", "manage_accounts"] as const) {
    assert.equal(roleCan("super_admin", cap), true, cap);
  }
  assert.equal(roleCan("analytics_admin", "impersonate"), false);
  assert.equal(roleCan("analytics_admin", "manage_users"), false);
  assert.equal(roleCan("billing_admin", "impersonate"), false);
  assert.equal(roleCan("support_admin", "manage_trials"), false);
});

test("impersonation requires a real reason", () => {
  assert.equal(validImpersonationReason(""), null);
  assert.equal(validImpersonationReason("help"), null);
  assert.equal(validImpersonationReason(42), null);
  assert.equal(validImpersonationReason("x".repeat(501)), null);
  assert.equal(validImpersonationReason("  Customer says heatmap is empty  "), "Customer says heatmap is empty");
});
