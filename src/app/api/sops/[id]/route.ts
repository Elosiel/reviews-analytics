/**
 * PATCH /api/sops/[id]
 *
 * Manager edits and activates a drafted SOP. This is the only path an
 * SOP's status changes — RAAI drafts, a human approves. Activating one
 * SOP archives any previously active SOP for the same category (only
 * one active standard per category, enforced by a partial unique index
 * on sops(tenant_id, category) where status = 'active').
 *
 * Body: { title?: string, content?: string, status?: 'draft'|'active'|'archived' }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  const tenantId: string | undefined = profileRow?.tenant_id;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { data: existing } = await supabase
    .from("sops")
    .select("id, tenant_id, category, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") updates.content = body.content;

  if (body.status && body.status !== existing.status) {
    if (!["draft", "active", "archived"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (body.status === "active") {
      // Only one active SOP per category — archive the current one first
      await supabase
        .from("sops")
        .update({ status: "archived" })
        .eq("tenant_id", tenantId)
        .eq("category", existing.category)
        .eq("status", "active");
      updates.activated_at = new Date().toISOString();
    }
    updates.status = body.status;
  }

  const { data, error } = await supabase
    .from("sops")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
