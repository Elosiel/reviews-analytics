/**
 * POST /api/sops/generate
 *
 * Drafts an SOP for a category from the tenant's current drift alerts +
 * recent guest quotes. Manager-triggered only (e.g. from a "Draft this
 * SOP" button on a suggested-SOP banner) — RAAI drafts, it never
 * activates. The manager reviews and activates via PATCH /api/sops/[id].
 *
 * Body: { category: SentimentCategory, drift_alert_id?: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftSop, type SopTriggerLocation } from "@/lib/pipeline/claude";
import type { RestaurantProfile, SentimentCategory } from "@/types";

const VALID_CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];

const QUOTES_PER_LOCATION = 3;

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const category: SentimentCategory = body.category;
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Find the location(s) currently flagged for this category
  let alertsQuery = supabase
    .from("drift_alerts")
    .select("id, location_id, score_before, score_after, delta")
    .eq("tenant_id", tenantId)
    .eq("category", category)
    .eq("resolved", false);
  if (body.drift_alert_id) alertsQuery = alertsQuery.eq("id", body.drift_alert_id);
  const { data: alerts } = await alertsQuery;

  if (!alerts?.length) {
    return NextResponse.json(
      { error: "No unresolved drift alert for this category — nothing to draft from." },
      { status: 400 }
    );
  }

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .in("id", alerts.map((a) => a.location_id));
  const locationNames = new Map((locations ?? []).map((l) => [l.id, l.name as string]));

  const { data: profileCtx } = await supabase
    .from("tenant_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const profile: RestaurantProfile = {
    mission: profileCtx?.mission ?? "",
    cuisine_style: profileCtx?.cuisine_style ?? "",
    target_guests: profileCtx?.target_guests ?? "",
    price_point: profileCtx?.price_point ?? "$$",
    goals: profileCtx?.goals ?? "",
    notes: profileCtx?.notes ?? "",
    website_url: profileCtx?.website_url ?? "",
    menu_url: profileCtx?.menu_url ?? "",
  };

  // Pull recent quotes per flagged location — only reviews whose text
  // hasn't been purged yet (the 30-day rule applies here too).
  const triggerLocations: SopTriggerLocation[] = [];
  const evidenceRows: {
    tenant_id: string;
    review_id: string;
    location_id: string;
    location_name: string;
    quote_text: string;
    star_rating: number;
    reviewed_at: string;
    content_purge_at: string;
  }[] = [];

  for (const alert of alerts) {
    const locationName = locationNames.get(alert.location_id) ?? "Unknown location";

    const { data: cats } = await supabase
      .from("review_categories")
      .select(`
        sentiment_score,
        reviews!inner(id, review_text, star_rating, reviewed_at, content_purge_at, location_id)
      `)
      .eq("tenant_id", tenantId)
      .eq("category", category)
      .eq("reviews.location_id", alert.location_id)
      .not("reviews.review_text", "is", null)
      .order("reviews(reviewed_at)", { ascending: false })
      .limit(QUOTES_PER_LOCATION);

    const rows = (cats ?? []) as unknown as {
      sentiment_score: number;
      reviews: { id: string; review_text: string; star_rating: number; reviewed_at: string; content_purge_at: string };
    }[];

    triggerLocations.push({
      location_name: locationName,
      mention_count: rows.length,
      avg_sentiment_score: alert.score_after,
      sentiment_delta: alert.delta,
      quotes: rows.map((r) => r.reviews.review_text),
    });

    for (const r of rows) {
      evidenceRows.push({
        tenant_id: tenantId,
        review_id: r.reviews.id,
        location_id: alert.location_id,
        location_name: locationName,
        quote_text: r.reviews.review_text,
        star_rating: r.reviews.star_rating,
        reviewed_at: r.reviews.reviewed_at,
        content_purge_at: r.reviews.content_purge_at,
      });
    }
  }

  const draft = await draftSop(category, triggerLocations, profile);

  const { data: sop, error: sopErr } = await supabase
    .from("sops")
    .insert({
      tenant_id: tenantId,
      category,
      title: draft.title,
      content: draft.content,
      status: "draft",
      ai_generated: true,
      source_summary: `Drafted from ${alerts.length} unresolved drift alert${alerts.length !== 1 ? "s" : ""} — ${triggerLocations.map((l) => l.location_name).join(", ")}.`,
      source_drift_alert_id: alerts[0].id,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (sopErr || !sop) {
    return NextResponse.json({ error: sopErr?.message ?? "Failed to create SOP" }, { status: 500 });
  }

  if (evidenceRows.length > 0) {
    await supabase.from("sop_evidence_quotes").insert(
      evidenceRows.map((r) => ({ ...r, sop_id: sop.id }))
    );
  }

  return NextResponse.json({ data: sop, error: null });
}
