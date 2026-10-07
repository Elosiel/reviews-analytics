import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { audit, requestMeta, requireAdminApi } from "@/lib/admin/auth";
import { readJson, UUID_RE } from "@/lib/admin/api";
import { IMPERSONATION_MINUTES, validImpersonationReason } from "@/lib/admin/access";
import { IMP_COOKIE, IMP_META_COOKIE, encodeImpersonationMeta } from "@/lib/admin/impersonation-shared";
import { sealImpersonation, sessionIdFromAccessToken } from "@/lib/admin/impersonation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { restaurantDisplayName } from "@/lib/team/invite-shared";

/**
 * "View as user": opens a separate, short-lived Supabase session for the
 * customer (via a one-time sign-in link the server generates and verifies
 * itself — nothing is emailed, no password is touched). The admin's own
 * session is parked, encrypted, in an httpOnly cookie so Exit can restore it.
 *
 * Guarantees:
 *   - Super Admin with two-factor only; a written reason is required.
 *   - Never another admin, a disabled user, or an unconfirmed email.
 *   - Read-only: the middleware refuses writes, and the database refuses
 *     writes from this session id (is_impersonating()).
 *   - Ends after 30 minutes: the middleware ends it on the next request and
 *     a pg_cron job revokes the session server-side even if the tab is closed.
 *   - Recorded in impersonation_sessions and the append-only audit log.
 */
export async function POST(request: Request) {
  const admin = await requireAdminApi("impersonate");
  if (admin instanceof NextResponse) return admin;

  const body = await readJson(request);
  const userId = typeof body.userId === "string" && UUID_RE.test(body.userId) ? body.userId : null;
  const reason = validImpersonationReason(body.reason);
  if (!userId) return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Give a reason (at least 10 characters)." }, { status: 400 });
  if (userId === admin.userId) return NextResponse.json({ error: "You can't view as yourself." }, { status: 400 });

  const service = createServiceClient();
  const [{ data: target }, { data: targetAdmin }, { data: profile }] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle(),
    service.from("profiles").select("tenant_id").eq("id", userId).maybeSingle(),
  ]);
  const u = target?.user;
  if (!u?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (targetAdmin) return NextResponse.json({ error: "Admin accounts can't be impersonated." }, { status: 403 });
  if (u.banned_until && Date.parse(u.banned_until) > Date.now()) return NextResponse.json({ error: "This user is disabled." }, { status: 400 });
  if (!u.email_confirmed_at) return NextResponse.json({ error: "This user hasn't confirmed their email yet." }, { status: 400 });

  const supabase = await createClient();
  const { data: { session: adminSession } } = await supabase.auth.getSession();
  if (!adminSession?.refresh_token) return NextResponse.json({ error: "Your admin session is missing — sign in again." }, { status: 401 });

  const meta = await requestMeta();
  const expiresAt = Date.now() + IMPERSONATION_MINUTES * 60 * 1000;
  const { data: imp, error: impErr } = await service
    .from("impersonation_sessions")
    .insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      target_user_id: userId,
      target_email: u.email,
      target_tenant_id: profile?.tenant_id ?? null,
      reason,
      expires_at: new Date(expiresAt).toISOString(),
      ip: meta.ip,
      user_agent: meta.userAgent,
    })
    .select("id")
    .single();
  if (impErr || !imp) return NextResponse.json({ error: "Couldn't start the session." }, { status: 500 });

  // One-time sign-in token for the customer, generated and consumed here.
  const { data: link, error: linkErr } = await service.auth.admin.generateLink({ type: "magiclink", email: u.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    await service.from("impersonation_sessions").update({ ended_at: new Date().toISOString(), end_reason: "failed_to_start" }).eq("id", imp.id);
    return NextResponse.json({ error: "Couldn't open a session for this user." }, { status: 502 });
  }
  // Swaps the browser's auth cookies to the customer's new session.
  let verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verified.error) verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  const customerSession = verified.data?.session;
  if (verified.error || !customerSession) {
    await service.from("impersonation_sessions").update({ ended_at: new Date().toISOString(), end_reason: "failed_to_start" }).eq("id", imp.id);
    return NextResponse.json({ error: "Couldn't open a session for this user." }, { status: 502 });
  }
  await service
    .from("impersonation_sessions")
    .update({ auth_session_id: sessionIdFromAccessToken(customerSession.access_token) })
    .eq("id", imp.id);

  const { data: locs } = profile?.tenant_id
    ? await service.from("locations").select("name").eq("tenant_id", profile.tenant_id)
    : { data: [] };
  const org = (locs ?? []).length ? restaurantDisplayName((locs ?? []).map((l) => l.name)) : "their account";

  const jar = await cookies();
  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: IMPERSONATION_MINUTES * 60 + 300 };
  jar.set(IMP_COOKIE, sealImpersonation({ id: imp.id, adminRefreshToken: adminSession.refresh_token, exp: expiresAt }), cookieOpts);
  jar.set(IMP_META_COOKIE, encodeImpersonationMeta({ id: imp.id, exp: expiresAt, label: `${u.email} · ${org}`, tenantId: profile?.tenant_id ?? null }), cookieOpts);

  await audit(admin, "impersonation.started", {
    type: "user",
    id: userId,
    tenantId: profile?.tenant_id ?? null,
    details: { target_email: u.email, reason, impersonation_session_id: imp.id, expires_at: new Date(expiresAt).toISOString() },
  });
  return NextResponse.json({ ok: true });
}
