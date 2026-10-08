import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  decideAdminAccess,
  roleCan,
  type AdminCapability,
  type AdminRole,
  type VerifiedClaims,
} from "@/lib/admin/access";

export interface AdminContext {
  userId: string;
  email: string;
  role: AdminRole;
  sessionId: string | null;
}

/**
 * Server-side Super Admin check — the only gate for every /super-admin page
 * and /api/super-admin route. Verifies the session JWT (getClaims), then
 * reads the caller's admin_users row with the service role. Never trusts
 * anything from the browser beyond the session cookie itself.
 */
export async function getAdminAccess() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = (error ? null : data?.claims) as VerifiedClaims | null;
  if (!claims?.sub) return { access: decideAdminAccess(null, null), claims: null };

  const { data: admin } = await createServiceClient()
    .from("admin_users")
    .select("role, disabled_at")
    .eq("user_id", claims.sub)
    .maybeSingle();
  return { access: decideAdminAccess(claims, admin), claims };
}

function toContext(claims: VerifiedClaims, role: AdminRole): AdminContext {
  return { userId: claims.sub, email: claims.email ?? "", role, sessionId: claims.session_id ?? null };
}

/** For Server Components / layouts: redirects anyone who isn't a verified admin. */
export async function requireAdminPage(capability: AdminCapability = "view"): Promise<AdminContext> {
  const { access, claims } = await getAdminAccess();
  if (!access.ok) {
    redirect(access.reason === "mfa_required" ? "/super-admin/login?step=mfa" : "/super-admin/login");
  }
  if (!roleCan(access.role, capability)) redirect("/super-admin?denied=1");
  return toContext(claims!, access.role);
}

/**
 * For route handlers: returns the admin context, or a ready-made 401/403
 * response. Usage:
 *   const gate = await requireAdminApi("manage_users");
 *   if (gate instanceof NextResponse) return gate;
 */
export async function requireAdminApi(capability: AdminCapability = "view"): Promise<AdminContext | NextResponse> {
  const { access, claims } = await getAdminAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason === "unauthenticated" ? "Not signed in" : access.reason === "mfa_required" ? "Two-factor authentication required" : "Forbidden" },
      { status: access.reason === "unauthenticated" ? 401 : 403 }
    );
  }
  if (!roleCan(access.role, capability)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return toContext(claims!, access.role);
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Append-only audit entry for a privileged action. Never throws. */
export async function audit(
  ctx: Pick<AdminContext, "userId" | "email">,
  action: string,
  target: { type?: string; id?: string; tenantId?: string | null; details?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    const meta = await requestMeta();
    const { error } = await createServiceClient().from("admin_audit_log").insert({
      actor_user_id: ctx.userId,
      actor_email: ctx.email,
      action,
      target_type: target.type ?? null,
      target_id: target.id ?? null,
      tenant_id: target.tenantId ?? null,
      details: target.details ?? {},
      ip: meta.ip,
      user_agent: meta.userAgent,
    });
    if (error) console.error("audit insert failed:", error.message);
  } catch (e) {
    console.error("audit insert failed:", e instanceof Error ? e.message : e);
  }
}
