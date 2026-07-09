/**
 * POST /api/rollup/compute
 *
 * Computes category_rollups from review_categories.
 * This is what the dashboard reads — never raw reviews on page load.
 *
 * Windows computed: 7, 30, 90 days.
 * For each (tenant, location, category, window):
 *   - Count mentions, positive/negative/neutral
 *   - Compute avg_sentiment_score
 *   - Compute sentiment_delta vs prior equal-length window
 *   - Fire drift alerts if delta crosses thresholds
 *
 * Drift thresholds (paper-agreed, from spec):
 *   medium: delta < -0.2
 *   high:   delta < -0.4
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SentimentCategory } from "@/types";
import { DRIFT_THRESHOLD } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET;

const WINDOWS = [7, 30, 90];
const CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const trigger = body.trigger ?? "manual";

  if (trigger !== "manual" && !verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (trigger === "manual") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Computes rollups across every tenant in one pass (matching pg_cron's
  // own scope) — the auth check above just gates who can trigger it.
  const supabase = createServiceClient();

  // Get all (tenant_id, location_id) pairs to compute rollups for
  const { data: locations } = await supabase
    .from("locations")
    .select("id, tenant_id");

  if (!locations?.length) {
    return NextResponse.json({ message: "No locations found", computed: 0 });
  }

  const today = new Date().toISOString().split("T")[0];
  let totalComputed = 0;
  const driftAlerts: {
    tenant_id: string;
    location_id: string;
    category: SentimentCategory;
    severity: "medium" | "high";
    score_before: number;
    score_after: number;
    message: string;
  }[] = [];

  for (const loc of locations) {
    for (const windowDays of WINDOWS) {
      for (const category of CATEGORIES) {
        try {
          const windowStart = new Date();
          windowStart.setDate(windowStart.getDate() - windowDays);

          // Current window: reviews in last windowDays, joined through
          // reviews to filter on reviewed_at and location
          const { data: currentCats } = await supabase
            .from("review_categories")
            .select(`
              sentiment_score,
              sentiment,
              reviews!inner(reviewed_at, location_id)
            `)
            .eq("tenant_id", loc.tenant_id)
            .eq("category", category)
            .eq("reviews.location_id", loc.id)
            .gte("reviews.reviewed_at", windowStart.toISOString());

          // Prior window (for delta)
          const priorEnd = new Date(windowStart);
          const priorStart = new Date(windowStart);
          priorStart.setDate(priorStart.getDate() - windowDays);

          const { data: priorCats } = await supabase
            .from("review_categories")
            .select(`
              sentiment_score,
              reviews!inner(reviewed_at, location_id)
            `)
            .eq("tenant_id", loc.tenant_id)
            .eq("category", category)
            .eq("reviews.location_id", loc.id)
            .gte("reviews.reviewed_at", priorStart.toISOString())
            .lt("reviews.reviewed_at", priorEnd.toISOString());

          const current = currentCats ?? [];
          const prior = priorCats ?? [];

          if (current.length === 0) continue;

          const scores = current.map((r) => r.sentiment_score as number);
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

          const priorScores = prior.map((r) => r.sentiment_score as number);
          const priorAvg =
            priorScores.length > 0
              ? priorScores.reduce((a, b) => a + b, 0) / priorScores.length
              : null;

          const delta = priorAvg !== null ? avgScore - priorAvg : null;

          const positiveCount = current.filter(
            (r) => (r.sentiment as string) === "positive"
          ).length;
          const negativeCount = current.filter(
            (r) => (r.sentiment as string) === "negative"
          ).length;
          const neutralCount = current.filter(
            (r) => (r.sentiment as string) === "neutral"
          ).length;

          // Upsert rollup row
          await supabase.from("category_rollups").upsert(
            {
              tenant_id: loc.tenant_id,
              location_id: loc.id,
              category,
              window_days: windowDays,
              window_end: today,
              mention_count: current.length,
              positive_count: positiveCount,
              negative_count: negativeCount,
              neutral_count: neutralCount,
              avg_sentiment_score: parseFloat(avgScore.toFixed(3)),
              sentiment_delta: delta !== null ? parseFloat(delta.toFixed(3)) : null,
              computed_at: new Date().toISOString(),
            },
            {
              onConflict: "tenant_id,location_id,category,window_days,window_end",
            }
          );

          totalComputed++;

          // Check drift thresholds (30-day window only, per spec)
          if (windowDays === 30 && delta !== null) {
            const severity =
              delta <= DRIFT_THRESHOLD.high
                ? "high"
                : delta <= DRIFT_THRESHOLD.medium
                ? "medium"
                : null;

            if (severity && priorAvg !== null) {
              // Check if alert already exists (don't duplicate)
              const { count } = await supabase
                .from("drift_alerts")
                .select("*", { count: "exact", head: true })
                .eq("tenant_id", loc.tenant_id)
                .eq("location_id", loc.id)
                .eq("category", category)
                .eq("resolved", false);

              if (!count || count === 0) {
                driftAlerts.push({
                  tenant_id: loc.tenant_id,
                  location_id: loc.id,
                  category,
                  severity,
                  score_before: parseFloat(priorAvg.toFixed(3)),
                  score_after: parseFloat(avgScore.toFixed(3)),
                  message: buildAlertMessage(category, severity, delta, avgScore),
                });
              }
            }
          }

        } catch (err) {
          console.error(
            `Rollup failed for ${loc.id}/${category}/${windowDays}d:`,
            err
          );
        }
      }
    }
  }

  // Insert new drift alerts
  if (driftAlerts.length > 0) {
    await supabase.from("drift_alerts").insert(
      driftAlerts.map((a) => ({
        ...a,
        detected_at: new Date().toISOString(),
        resolved: false,
      }))
    );
  }

  return NextResponse.json({
    computed: totalComputed,
    drift_alerts_created: driftAlerts.length,
  });
}

function buildAlertMessage(
  category: SentimentCategory,
  severity: "medium" | "high",
  delta: number,
  currentScore: number
): string {
  const LABELS: Record<SentimentCategory, string> = {
    food: "Food quality",
    service: "Service",
    atmosphere: "Atmosphere",
    value: "Value",
    wait_time: "Wait time",
    cleanliness: "Cleanliness",
  };
  const label = LABELS[category];
  const deltaStr = delta.toFixed(2);
  const scoreStr = currentScore.toFixed(2);

  if (severity === "high") {
    return `${label} sentiment has dropped sharply (${deltaStr} over 30 days, now at ${scoreStr}). This is in high 1–2★ review territory — investigate immediately.`;
  }
  return `${label} sentiment is declining (${deltaStr} over 30 days, now at ${scoreStr}). Monitor closely and address before it worsens.`;
}
