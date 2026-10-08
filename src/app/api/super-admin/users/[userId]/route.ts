import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { readJson, UUID_RE } from "@/lib/admin/api";
import { createServiceClient } from "@/lib/supabase/service";

const ACTIONS = ["reset_password", "disable", "enable", "sign_out"] as const;
type Action = (typeof ACTIONS)[number];

// Account actions on a single login. Passwords are never read or set here:
// a reset sends Supabase's own reset email so the user picks a new one.
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdminApi("manage_users");
  if (admin instanceof NextResponse) return admin;
  const { userId } = await params;
  if (!UUID_RE.test(userId)) return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  const action = (await readJson(request)).action as Action;
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const service = createServiceClient();
  const [{ data: target, error: targetErr }, { data: profile }, { data: targetAdmin }] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from("profiles").select("tenant_id").eq("id", userId).maybeSingle(),
    service.from("admin_users").select("user_id").eq("user_id", userId).is("disabled_at", null).maybeSingle(),
  ]);
  if (targetErr || !target?.user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const email = target.user.email;
  const tenantId = profile?.tenant_id ?? null;

  // Admin accounts are managed only through the database (see Settings).
  if (targetAdmin && action !== "reset_password") {
    return NextResponse.json({ error: "Admin accounts can't be disabled or signed out from the console." }, { status: 403 });
  }
  if (userId === admin.userId && action !== "reset_password") {
    return NextResponse.json({ error: "You can't do that to your own account." }, { status: 403 });
  }

  if (action === "reset_password") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const { error } = await service.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/reset-password` });
    if (error) {
      return NextResponse.json(
        { error: /rate limit/i.test(error.message) ? "Email rate limit reached — try again later." : "Couldn't send the reset email." },
        { status: 502 }
      );
    }
    await audit(admin, "user.password_reset_requested", { type: "user", id: userId, tenantId, details: { email } });
    return NextResponse.json({ ok: true });
  }

  if (action === "disable" || action === "enable") {
    const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: action === "disable" ? "876000h" : "none" });
    if (error) return NextResponse.json({ error: `Couldn't ${action} the user.` }, { status: 502 });
  }
  if (action === "disable" || action === "sign_out") {
    await service.rpc("admin_revoke_user_sessions", { p_user: userId });
  }
  await audit(admin, action === "disable" ? "user.disabled" : action === "enable" ? "user.enabled" : "user.signed_out", {
    type: "user",
    id: userId,
    tenantId,
    details: { email },
  });
  return NextResponse.json({ ok: true });
}
