import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { cleanNote, readJson, UUID_RE } from "@/lib/admin/api";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireAdminApi("manage_notes");
  if (admin instanceof NextResponse) return admin;
  const { tenantId } = await params;
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  const note = cleanNote((await readJson(request)).note);
  if (!note) return NextResponse.json({ error: "Write a note (up to 5,000 characters)." }, { status: 400 });

  const { data, error } = await createServiceClient()
    .from("account_notes")
    .insert({ tenant_id: tenantId, author_user_id: admin.userId, author_email: admin.email, note })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't save the note." }, { status: 500 });
  await audit(admin, "note.added", { type: "account", id: data.id, tenantId });
  return NextResponse.json({ ok: true });
}
