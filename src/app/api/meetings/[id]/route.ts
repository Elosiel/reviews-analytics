/**
 * GET /api/meetings/[id]
 *
 * A single meeting's agenda plus its evidence quotes — quote_text is
 * null for any snapshot whose source review has crossed its 30-day
 * content_purge_at (the daily purge job nulls it the same way it nulls
 * reviews.review_text). The agenda's discussion points and suggested
 * actions are unaffected — they're paraphrased analysis, retained
 * indefinitely.
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

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: quotes } = await supabase
    .from("meeting_quote_snapshots")
    .select("*")
    .eq("meeting_id", id)
    .eq("tenant_id", tenantId);

  return NextResponse.json({ data: { ...meeting, quotes: quotes ?? [] }, error: null });
}
