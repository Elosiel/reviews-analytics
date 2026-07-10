/**
 * GET /api/reports/[id]
 *
 * A single stored weekly report plus its evidence quotes — quote_text is
 * null for any snapshot whose source review has crossed its 30-day
 * content_purge_at (the daily purge job nulls it the same way it nulls
 * reviews.review_text). The report's own narrative fields (summary,
 * theme descriptions, verdicts, actions) are unaffected — they're
 * paraphrased analysis, retained indefinitely.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
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

  const { data: report, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: quotes } = await supabase
    .from("report_quote_snapshots")
    .select("*")
    .eq("report_id", id)
    .eq("tenant_id", tenantId);

  return NextResponse.json({ data: { ...report, quotes: quotes ?? [] }, error: null });
}
