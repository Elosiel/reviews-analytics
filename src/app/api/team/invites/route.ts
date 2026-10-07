/**
 * POST /api/team/invites — owner invites a teammate by email.
 *
 * Writes go through the service role (team_invites is read-only to users);
 * the tenant always comes from the caller's own profile, never the request.
 * Returns the invite link so the owner can share it even if email isn't
 * configured. Re-inviting the same email replaces the pending invite.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMembership, OWNER_ONLY_MESSAGE } from "@/lib/team/membership";
import { hashInviteToken, newInviteToken } from "@/lib/team/invite-token";
import { isValidEmail, normalizeEmail, restaurantDisplayName } from "@/lib/team/invite-shared";
import { sendInviteEmail } from "@/lib/team/invite-email";
import { recordEvent } from "@/lib/telemetry/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await getMembership(supabase);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: OWNER_ONLY_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: teammates } = await service
    .from("profiles")
    .select("email")
    .eq("tenant_id", me.tenantId);
  if ((teammates ?? []).some((t) => normalizeEmail(t.email) === email)) {
    return NextResponse.json({ error: "That person is already on your team." }, { status: 400 });
  }

  // One pending invite per email: a re-invite replaces the old link.
  await service
    .from("team_invites")
    .delete()
    .eq("tenant_id", me.tenantId)
    .eq("email", email)
    .is("accepted_at", null);

  const token = newInviteToken();
  const { data: invite, error } = await service
    .from("team_invites")
    .insert({ tenant_id: me.tenantId, email, token_hash: hashInviteToken(token), invited_by: me.user.id })
    .select("id, email, created_at, expires_at")
    .single();
  if (error || !invite) {
    console.error("Invite insert failed:", error);
    return NextResponse.json({ error: "We couldn't create the invite. Please try again." }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const inviteUrl = `${appUrl}/invite/${token}`;

  const [{ data: locations }, { data: inviter }] = await Promise.all([
    service.from("locations").select("name").eq("tenant_id", me.tenantId),
    service.from("profiles").select("full_name, email").eq("id", me.user.id).single(),
  ]);
  const emailed = await sendInviteEmail({
    to: email,
    inviteUrl,
    inviterName: inviter?.full_name || inviter?.email || "Your teammate",
    restaurantName: restaurantDisplayName((locations ?? []).map((l) => l.name)),
  });

  await recordEvent({ type: "team_invite_sent", tenantId: me.tenantId, userId: me.user.id });
  return NextResponse.json({ invite, invite_url: inviteUrl, emailed });
}
