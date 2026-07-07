/**
 * GET /api/meetings
 *
 * Lists the tenant's saved meeting history, filterable by the same
 * dimensions the Meetings tab lets a manager pick: location, city,
 * category, date. Query params:
 *   ?location_id=<uuid>  — meetings generated for a location containing this id
 *   ?city=<text>          — meetings generated with this city filter
 *   ?category=<category>  — meetings whose categories list includes this one
 *   ?from=<date>&to=<date> — meetings whose date range overlaps this window
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("location_id");
  const city = searchParams.get("city");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("meetings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("generated_at", { ascending: false });

  if (locationId) query = query.contains("location_ids", [locationId]);
  if (city) query = query.ilike("city", `%${city}%`);
  if (category) query = query.contains("categories", [category]);
  if (from) query = query.gte("date_end", from);
  if (to) query = query.lte("date_start", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, error: null });
}
