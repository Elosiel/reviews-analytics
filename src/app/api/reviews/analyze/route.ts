/**
 * POST /api/reviews/analyze
 *
 * Runs not-yet-analyzed reviews through Claude for sentiment
 * categorization — only reviews written inside the import window (last
 * 90 days, the widest rollup window). Older reviews stay listed with their
 * stars but never cost an AI call.
 *
 * Called by:
 *   - /api/reviews/sync (after ingest)
 *   - pg_cron "analysis-catch-up" every 5 minutes (picks up whatever a
 *     previous run didn't finish)
 *   - Manual "Resume analysis" from the dashboard
 *
 * Answers right away and works in the background (pg_cron's HTTP call gives
 * up after 5 seconds): up to ~40s, a few reviews in parallel, then hands off
 * to a fresh run. Vercel caps how many times an app can call itself in a
 * row, so the self-hand-off is best-effort; the cron job is what guarantees
 * the backlog drains. On progress, triggers /api/rollup/compute.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeReview } from "@/lib/pipeline/claude";
import { importCutoffMs } from "@/lib/reviews/import-window";
import { logAppError } from "@/lib/telemetry/server";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 10;
const CONCURRENCY = 4;
const TIME_BUDGET_MS = 40_000;
// A catch-up run steps aside when analysis landed this recently: a run is
// still going, and two would pick the same pending reviews.
const ACTIVE_RUN_MS = 90_000;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
}

interface PendingReview {
  id: string;
  tenant_id: string;
  location_id: string;
  star_rating: number;
  review_text: string;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const trigger = body.trigger ?? "manual";

  if (trigger !== "manual") {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Processes pending reviews across every tenant (matching pg_cron's own
  // scope) — the auth check above only gates who can trigger it, so callers
  // get no review ids, counts, or error text back.
  after(() => analyzePending(trigger === "scheduled_catchup"));
  return NextResponse.json({ started: true });
}

async function analyzePending(isCatchUp: boolean) {
  const supabase = createServiceClient();

  if (isCatchUp) {
    const { data: last } = await supabase
      .from("review_analyses")
      .select("analyzed_at")
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.analyzed_at).getTime() < ACTIVE_RUN_MS) return;
  }

  const since = new Date(importCutoffMs()).toISOString();
  const started = Date.now();
  const failed = new Set<string>();
  let succeeded = 0;
  let moreLeft = false;

  async function analyzeOne(review: PendingReview): Promise<boolean> {
    try {
      const analysis = await analyzeReview({
        review_id: review.id,
        star_rating: review.star_rating,
        review_text: review.review_text,
      });

      const { data: analysisRow, error: analysisErr } = await supabase
        .from("review_analyses")
        .insert({
          tenant_id: review.tenant_id,
          review_id: review.id,
          model_used: "claude",
          flag_health_safety: analysis.danger_flags.health_safety,
          flag_legal: analysis.danger_flags.legal,
          flag_discrimination: analysis.danger_flags.discrimination,
          flag_physical_safety: analysis.danger_flags.physical_safety,
        })
        .select("id")
        .single();
      if (analysisErr || !analysisRow) throw new Error(analysisErr?.message);

      if (analysis.categories.length > 0) {
        const { error: catErr } = await supabase.from("review_categories").insert(
          analysis.categories.map((c) => ({
            tenant_id: review.tenant_id,
            analysis_id: analysisRow.id,
            review_id: review.id,
            category: c.category,
            sentiment_score: c.sentiment_score,
            confidence: c.confidence,
          }))
        );
        if (catErr) throw new Error(catErr.message);
      }
      return true;
    } catch (err) {
      console.error(`Analysis failed for review ${review.id}:`, err instanceof Error ? err.message : err);
      await logAppError({ category: "analysis", source: "review analysis", error: err, tenantId: review.tenant_id, details: { location_id: review.location_id } });
      // Skipped for the rest of this run so one bad review can't loop it;
      // a later run retries it. (Two overlapping runs can't double-count:
      // review_analyses.review_id is unique, so the second insert fails.)
      failed.add(review.id);
      return false;
    }
  }

  while (Date.now() - started < TIME_BUDGET_MS) {
    // Newest first, so a fresh location's most relevant reviews land first.
    const { data, error } = await supabase.rpc("pending_analysis_reviews", {
      p_since: since,
      p_limit: BATCH_SIZE + failed.size,
    });
    if (error) {
      console.error("pending_analysis_reviews failed:", error);
      break;
    }
    const batch = ((data ?? []) as PendingReview[]).filter((r) => !failed.has(r.id)).slice(0, BATCH_SIZE);
    if (batch.length === 0) {
      moreLeft = false;
      break;
    }
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const outcomes = await Promise.all(batch.slice(i, i + CONCURRENCY).map(analyzeOne));
      succeeded += outcomes.filter(Boolean).length;
    }
    moreLeft = true;
  }

  if (succeeded === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const internal = (path: string, payload: object) =>
    fetch(`${appUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET ?? "" },
      body: JSON.stringify(payload),
    }).catch((e) => console.error(`Failed to trigger ${path}:`, e));

  await Promise.all([
    internal("/api/rollup/compute", { trigger: "post_analysis" }),
    moreLeft ? internal("/api/reviews/analyze", { trigger: "post_sync" }) : null,
  ]);
}
