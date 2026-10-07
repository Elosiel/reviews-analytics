import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { cleanNote, readJson, UUID_RE } from "@/lib/admin/api";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi("manage_feedback");
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  const note = cleanNote((await readJson(request)).note);
  if (!note) return NextResponse.json({ error: "Write a note (up to 5,000 characters)." }, { status: 400 });

  const service = createServiceClient();
  const { data: fb } = await service.from("feedback").select("tenant_id").eq("id", id).maybeSingle();
  if (!fb) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await service.from("feedback_notes").insert({ feedback_id: id, author_user_id: admin.userId, author_email: admin.email, note });
  if (error) return NextResponse.json({ error: "Couldn't save the note." }, { status: 500 });
  await audit(admin, "feedback.note_added", { type: "feedback", id, tenantId: fb.tenant_id });
  return NextResponse.json({ ok: true });
}
