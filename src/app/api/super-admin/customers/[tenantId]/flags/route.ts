import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { readJson, UUID_RE } from "@/lib/admin/api";
import { createServiceClient } from "@/lib/supabase/service";

// Internal/test accounts are excluded from customer metrics.
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireAdminApi("manage_accounts");
  if (admin instanceof NextResponse) return admin;
  const { tenantId } = await params;
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  const body = await readJson(request);
  if (typeof body.is_internal !== "boolean") return NextResponse.json({ error: "is_internal must be true or false" }, { status: 400 });

  const { error } = await createServiceClient()
    .from("tenant_admin_flags")
    .upsert({ tenant_id: tenantId, is_internal: body.is_internal, updated_at: new Date().toISOString(), updated_by: admin.userId });
  if (error) return NextResponse.json({ error: "Couldn't update the account." }, { status: 500 });
  await audit(admin, "account.internal_flag_changed", { type: "account", id: tenantId, tenantId, details: { is_internal: body.is_internal } });
  return NextResponse.json({ ok: true });
}
