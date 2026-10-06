/**
 * DELETE /api/team/members/[id] — owner removes a teammate.
 *
 * The removed person keeps their login but moves to a new, empty account of
 * their own, so they immediately lose access to this restaurant's data.
 */
import { randomUUID } from "node:crypto";
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
  if (id === me.user.id) {
    return NextResponse.json({ error: "You can't remove yourself from your own account." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: target } = await service.from("profiles").select("tenant_id").eq("id", id).single();
  if (!target || target.tenant_id !== me.tenantId) {
    return NextResponse.json({ error: "That person isn't on your team." }, { status: 404 });
  }

  const { error } = await service
    .from("profiles")
    .update({ tenant_id: randomUUID(), team_role: "owner", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", me.tenantId);
  if (error) return NextResponse.json({ error: "We couldn't remove that teammate." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
