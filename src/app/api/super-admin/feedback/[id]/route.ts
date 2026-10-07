import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { readJson, UUID_RE } from "@/lib/admin/api";
import { createServiceClient } from "@/lib/supabase/service";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES } from "@/lib/telemetry/sanitize";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("manage_feedback");
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  const body = await readJson(request);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("status" in body) {
    if (!(FEEDBACK_STATUSES as readonly string[]).includes(body.status as string)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
    update.resolved_at = body.status === "resolved" || body.status === "closed" ? new Date().toISOString() : null;
  }
  if ("priority" in body) {
    if (body.priority !== null && !(FEEDBACK_PRIORITIES as readonly string[]).includes(body.priority as string)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    update.priority = body.priority;
  }
  if (!("status" in update) && !("priority" in update)) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const service = createServiceClient();
  const { data: before } = await service.from("feedback").select("tenant_id, status, priority").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await service.from("feedback").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  await audit(admin, "status" in update ? "feedback.status_changed" : "feedback.priority_changed", {
    type: "feedback",
    id,
    tenantId: before.tenant_id,
    details: "status" in update ? { from: before.status, to: update.status } : { from: before.priority, to: update.priority },
  });
  return NextResponse.json({ ok: true });
}
