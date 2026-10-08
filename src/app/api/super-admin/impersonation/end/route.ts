import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IMP_COOKIE, IMP_META_COOKIE } from "@/lib/admin/impersonation-shared";
import { openImpersonation } from "@/lib/admin/impersonation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Ends a "view as user" session: revokes the customer session that was
 * opened for it, restores the admin's own (two-factor) session from the
 * encrypted cookie, records the end, and clears both cookies. Reached by the
 * banner's Exit button (POST), by the middleware on expiry, or by navigating
 * back to /super-admin (GET). Safe to hit with no session in progress.
 */
async function end(request: Request) {
  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") === "expired" ? "expired" : "exited";
  const jar = await cookies();
  const secret = openImpersonation(jar.get(IMP_COOKIE)?.value);
  // Nothing in progress: do nothing (so a stray link can't sign anyone out).
  if (!secret && !jar.get(IMP_META_COOKIE)) {
    return NextResponse.redirect(new URL("/dashboard", url.origin), { status: 303 });
  }
  const supabase = await createClient();
  const service = createServiceClient();

  // 1. End the customer session (server-side revoke, not just cookie removal).
  await supabase.auth.signOut({ scope: "local" });

  let destination = "/super-admin/login";
  if (secret) {
    const { data: row } = await service
      .from("impersonation_sessions")
      .select("id, admin_user_id, admin_email, target_user_id, target_tenant_id, auth_session_id, ended_at")
      .eq("id", secret.id)
      .maybeSingle();
    if (row && !row.ended_at) {
      await service.from("impersonation_sessions").update({ ended_at: new Date().toISOString(), end_reason: reason }).eq("id", row.id);
      await service.from("admin_audit_log").insert({
        actor_user_id: row.admin_user_id,
        actor_email: row.admin_email,
        action: reason === "expired" ? "impersonation.expired" : "impersonation.ended",
        target_type: "user",
        target_id: row.target_user_id,
        tenant_id: row.target_tenant_id,
        details: { impersonation_session_id: row.id },
      });
    }
    // 2. Restore the admin's own session.
    const { error } = await supabase.auth.refreshSession({ refresh_token: secret.adminRefreshToken });
    if (!error) destination = row?.target_tenant_id ? `/super-admin/customers/${row.target_tenant_id}?tab=logins` : "/super-admin";
  }

  jar.delete(IMP_COOKIE);
  jar.delete(IMP_META_COOKIE);
  return NextResponse.redirect(new URL(destination, url.origin), { status: 303 });
}

export const GET = end;
export const POST = end;
