/**
 * POST /api/meetings/generate
 *
 * Builds a ready-made meeting agenda from filtered review trends —
 * location(s), city, date range, categories. On-demand and manager-
 * triggered (no auto-weekly generation in v1): the manager picks the
 * filters that match their actual meeting, RAAI turns the matching
 * issues into discussion points + suggested actions, and saves the
 * result to history.
 *
 * Verbatim quotes are snapshotted into meeting_quote_snapshots with
 * content_purge_at copied from the source review — same 30-day clock
 * as everywhere else, even if the requested date range reaches further
 * back (a quote is never shown once its source review's window closed).
 *
 * Body: {
 *   location_ids?: string[], city?: string,
 *   categories?: SentimentCategory[],
 *   date_start: string, date_end: string
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateMeetingAgenda, type MeetingAgendaSourceIssue } from "@/lib/pipeline/claude";
import { DRIFT_THRESHOLD } from "@/types";
import type { AlertSeverity, RestaurantProfile, SentimentCategory } from "@/types";

const ALL_CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];
const QUOTES_PER_ISSUE = 3;
const MAX_AGENDA_ISSUES = 10;

function severityFor(delta: number | null): AlertSeverity | null {
  if (delta === null) return null;
  if (delta <= DRIFT_THRESHOLD.high) return "high";
  if (delta <= DRIFT_THRESHOLD.medium) return "medium";
  return null;
}

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
  const dateStart: string | undefined = body.date_start;
  const dateEnd: string | undefined = body.date_end;
  if (!dateStart || !dateEnd) {
    return NextResponse.json({ error: "date_start and date_end are required" }, { status: 400 });
  }
  const categories: SentimentCategory[] =
    Array.isArray(body.categories) && body.categories.length ? body.categories : ALL_CATEGORIES;
  const requestedLocationIds: string[] | null = Array.isArray(body.location_ids) && body.location_ids.length
    ? body.location_ids
    : null;
  const city: string | null = body.city || null;

  // Resolve the target locations
  let locationsQuery = supabase.from("locations").select("id, name, address").eq("tenant_id", tenantId);
  if (requestedLocationIds) locationsQuery = locationsQuery.in("id", requestedLocationIds);
  else if (city) locationsQuery = locationsQuery.ilike("address", `%${city}%`);
  const { data: locations } = await locationsQuery;

  if (!locations?.length) {
    return NextResponse.json({ error: "No locations match these filters" }, { status: 400 });
  }
  const locationIds = locations.map((l) => l.id);
  const locationNames = new Map(locations.map((l) => [l.id, l.name as string]));

  const { data: rollups } = await supabase
    .from("category_rollups")
    .select("location_id, category, sentiment_delta")
    .eq("tenant_id", tenantId)
    .eq("window_days", 30)
    .in("location_id", locationIds)
    .in("category", categories);
  const deltaByKey = new Map((rollups ?? []).map((r) => [`${r.location_id}:${r.category}`, r.sentiment_delta as number | null]));

  const { data: activeSops } = await supabase
    .from("sops")
    .select("id, category")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("category", categories);
  const sopByCategory = new Map((activeSops ?? []).map((s) => [s.category as string, s.id as string]));

  // Pull every (location, category) combination's scores + sample quotes
  // in the requested date range, in one query.
  const { data: catRows } = await supabase
    .from("review_categories")
    .select(`
      category,
      sentiment_score,
      reviews!inner(id, review_text, star_rating, reviewed_at, content_purge_at, location_id)
    `)
    .eq("tenant_id", tenantId)
    .in("category", categories)
    .in("reviews.location_id", locationIds)
    .gte("reviews.reviewed_at", dateStart)
    .lte("reviews.reviewed_at", dateEnd);

  type Row = {
    category: SentimentCategory;
    sentiment_score: number;
    reviews: { id: string; review_text: string | null; star_rating: number; reviewed_at: string; content_purge_at: string; location_id: string };
  };
  const rows = (catRows ?? []) as unknown as Row[];

  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.reviews.location_id}:${row.category}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const sourceIssues: MeetingAgendaSourceIssue[] = [];
  const quoteSnapshots: {
    tenant_id: string;
    review_id: string;
    location_id: string;
    location_name: string;
    category: SentimentCategory;
    quote_text: string;
    star_rating: number;
    reviewed_at: string;
    content_purge_at: string;
  }[] = [];

  for (const [key, group] of grouped) {
    const [locationId, category] = key.split(":") as [string, SentimentCategory];
    const scores = group.map((r) => r.sentiment_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const delta = deltaByKey.get(key) ?? null;

    const quoted = group.filter((r) => r.reviews.review_text).slice(0, QUOTES_PER_ISSUE);
    for (const r of quoted) {
      quoteSnapshots.push({
        tenant_id: tenantId,
        review_id: r.reviews.id,
        location_id: locationId,
        location_name: locationNames.get(locationId) ?? "Unknown location",
        category,
        quote_text: r.reviews.review_text!,
        star_rating: r.reviews.star_rating,
        reviewed_at: r.reviews.reviewed_at,
        content_purge_at: r.reviews.content_purge_at,
      });
    }

    sourceIssues.push({
      category,
      location_id: locationId,
      location_name: locationNames.get(locationId) ?? "Unknown location",
      mention_count: group.length,
      avg_sentiment_score: parseFloat(avgScore.toFixed(3)),
      sentiment_delta: delta,
      severity: severityFor(delta),
      quotes: quoted.map((r) => r.reviews.review_text!),
      linked_sop_id: sopByCategory.get(category),
    });
  }

  if (sourceIssues.length === 0) {
    return NextResponse.json({ error: "No reviews match these filters in that date range" }, { status: 400 });
  }

  // Worst sentiment first — that's what the meeting should open with
  sourceIssues.sort((a, b) => a.avg_sentiment_score - b.avg_sentiment_score);
  const topIssues = sourceIssues.slice(0, MAX_AGENDA_ISSUES);

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

  const agenda = await generateMeetingAgenda(topIssues, profile);

  const locationLabel = requestedLocationIds
    ? locations.map((l) => l.name).join(", ")
    : city
    ? city
    : "All locations";
  const categoryLabel = categories.length === ALL_CATEGORIES.length ? "" : ` — ${categories.join(", ")}`;
  const title = `${locationLabel}${categoryLabel} · ${dateStart} to ${dateEnd}`;

  const { data: meeting, error: meetingErr } = await supabase
    .from("meetings")
    .insert({
      tenant_id: tenantId,
      title,
      location_ids: requestedLocationIds,
      city,
      categories: categories.length === ALL_CATEGORIES.length ? null : categories,
      date_start: dateStart,
      date_end: dateEnd,
      agenda,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (meetingErr || !meeting) {
    return NextResponse.json({ error: meetingErr?.message ?? "Failed to create meeting" }, { status: 500 });
  }

  const relevantQuotes = quoteSnapshots.filter((q) =>
    topIssues.some((i) => i.location_id === q.location_id && i.category === q.category)
  );
  if (relevantQuotes.length > 0) {
    await supabase.from("meeting_quote_snapshots").insert(
      relevantQuotes.map((q) => ({ ...q, meeting_id: meeting.id }))
    );
  }

  return NextResponse.json({ data: meeting, error: null });
}
