/**
 * POST /api/team/invites/accept — the signed-in user accepts an invite.
 *
 * All checks (valid, unused, unexpired, issued to the caller's own confirmed
 * email, caller's current account has no data) run atomically inside the
 * accept_team_invite() database function, as the caller.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/team/invite-token";
import { acceptInviteMessage } from "@/lib/team/invite-shared";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ result: "not_signed_in", error: acceptInviteMessage("not_signed_in") }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ result: "invalid", error: acceptInviteMessage("invalid") }, { status: 400 });

  const { data: result, error } = await supabase.rpc("accept_team_invite", { p_token_hash: hashInviteToken(token) });
  if (error) {
    console.error("accept_team_invite failed:", error);
    return NextResponse.json({ result: "error", error: "We couldn't accept the invite. Please try again." }, { status: 500 });
  }
  const ok = result === "joined" || result === "already_member";
  return NextResponse.json({ result, error: ok ? null : acceptInviteMessage(String(result)) }, { status: ok ? 200 : 400 });
}
