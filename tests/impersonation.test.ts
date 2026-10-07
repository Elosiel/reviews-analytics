import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encodeImpersonationMeta,
  impersonationBlocksRequest,
  impersonationExpired,
  parseImpersonationMeta,
} from "../src/lib/admin/impersonation-shared.ts";

process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
const { openImpersonation, sealImpersonation, sessionIdFromAccessToken } = await import("../src/lib/admin/impersonation.ts");

test("impersonation is read-only: every write is refused except telemetry and Exit", () => {
  assert.equal(impersonationBlocksRequest("GET", "/dashboard"), false);
  assert.equal(impersonationBlocksRequest("HEAD", "/dashboard"), false);
  assert.equal(impersonationBlocksRequest("POST", "/api/events"), false);
  assert.equal(impersonationBlocksRequest("POST", "/api/super-admin/impersonation/end"), false);
  for (const [m, p] of [
    ["POST", "/api/feedback"],
    ["POST", "/api/team/invites"],
    ["DELETE", "/api/team/members/x"],
    ["POST", "/api/locations/sync"],
    ["POST", "/dashboard/settings"], // server actions
    ["PATCH", "/api/super-admin/feedback/x"],
    ["POST", "/api/events/extra"],
  ]) {
    assert.equal(impersonationBlocksRequest(m, p), true, `${m} ${p}`);
  }
});

test("10/11. banner metadata round-trips; expiry is strict; junk is rejected", () => {
  const meta = { id: "imp-1", exp: Date.parse("2026-10-08T12:30:00Z"), label: "owner@x.com · Terra Gaucha", tenantId: "t1" };
  const parsed = parseImpersonationMeta(encodeImpersonationMeta(meta));
  assert.deepEqual(parsed, meta);
  assert.equal(impersonationExpired(meta, meta.exp - 1), false);
  assert.equal(impersonationExpired(meta, meta.exp), true);
  assert.equal(parseImpersonationMeta("not json"), null);
  assert.equal(parseImpersonationMeta(encodeURIComponent(JSON.stringify({ id: 1 }))), null);
  assert.equal(parseImpersonationMeta(undefined), null);
});

test("the parked admin session is sealed (AES-GCM): tampering or a wrong key yields nothing", () => {
  const sealed = sealImpersonation({ id: "imp-1", adminRefreshToken: "refresh-abc", exp: 123 });
  assert.ok(!sealed.includes("refresh-abc"));
  assert.deepEqual(openImpersonation(sealed), { id: "imp-1", adminRefreshToken: "refresh-abc", exp: 123 });
  const parts = sealed.split(".");
  const tampered = [parts[0], parts[1], Buffer.from("x" + Buffer.from(parts[2], "base64url").toString("latin1"), "latin1").toString("base64url")].join(".");
  assert.equal(openImpersonation(tampered), null);
  assert.equal(openImpersonation("garbage"), null);
  assert.equal(openImpersonation(undefined), null);
  process.env.TOKEN_ENCRYPTION_KEY = "b".repeat(64);
  assert.equal(openImpersonation(sealed), null);
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
});

test("session id is read from the access token payload", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "u", session_id: "11111111-2222-3333-4444-555555555555" })).toString("base64url");
  assert.equal(sessionIdFromAccessToken(`h.${payload}.s`), "11111111-2222-3333-4444-555555555555");
  assert.equal(sessionIdFromAccessToken("nope"), null);
});
