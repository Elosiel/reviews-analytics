/**
 * GET /api/reports
 *
 * Lists the tenant's saved weekly reports, newest first — powers the
 * Reports history list.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("generated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
