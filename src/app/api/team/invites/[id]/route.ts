/** DELETE /api/team/invites/[id] — owner revokes a pending invite. */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMembership, OWNER_ONLY_MESSAGE } from "@/lib/team/membership";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await getMembership(supabase);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: OWNER_ONLY_MESSAGE }, { status: 403 });

  // Scoped to the owner's own tenant, so another account's invite id is a no-op.
  const { error } = await createServiceClient()
    .from("team_invites")
    .delete()
    .eq("id", id)
    .eq("tenant_id", me.tenantId)
    .is("accepted_at", null);
  if (error) return NextResponse.json({ error: "We couldn't revoke the invite." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
