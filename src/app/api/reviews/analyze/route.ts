/**
 * POST /api/reviews/analyze
 *
 * Finds all reviews that haven't been analyzed yet and runs them
 * through Claude for sentiment categorization.
 *
 * Called by:
 *   - /api/reviews/sync (after ingest)
 *   - pg_cron (catch-up on any missed analyses)
 *   - Manual trigger from settings
 *
 * Processes in batches of 10 to stay within Claude rate limits.
 * On completion triggers /api/rollup/compute to refresh aggregations.
 */

import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeReview } from "@/lib/pipeline/claude";

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 10;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
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

  // This route processes pending reviews across every tenant in one batch
  // (matching pg_cron's own scope) — the auth check above just gates who
  // can trigger it, so the actual work always runs as service-role.
  const supabase = createServiceClient();

  // Find reviews with no analysis yet, excluding those with null review_text
  // (already purged — can't analyze what we don't have). PostgREST filters
  // aren't raw SQL, so "not in (select ...)" has to be two queries: pull
  // already-analyzed ids, then exclude them from the candidate set.
  const { data: analyzedRows, error: analyzedErr } = await supabase
    .from("review_analyses")
    .select("review_id");

  if (analyzedErr) {
    return NextResponse.json({ error: analyzedErr.message }, { status: 500 });
  }

  const analyzedIds = (analyzedRows ?? []).map((r) => r.review_id);
  // A guaranteed-nonexistent id keeps this a single fluent chain (reassigning
  // the query builder to a `let` blows up TS with "excessively deep" errors)
  // while still excluding nothing when no reviews have been analyzed yet.
  const excludeIds = analyzedIds.length > 0 ? analyzedIds.join(",") : "00000000-0000-0000-0000-000000000000";

  const { data: pending, error } = await supabase
    .from("reviews")
    .select("id, tenant_id, location_id, star_rating, review_text")
    .not("review_text", "is", null)
    .not("id", "in", `(${excludeIds})`)
    .order("ingested_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending?.length) {
    return NextResponse.json({ analyzed: 0, message: "No pending reviews" });
  }

  const results: { review_id: string; success: boolean; error?: string }[] = [];

  for (const review of pending) {
    if (!review.review_text) continue;

    try {
      const analysis = await analyzeReview({
        review_id: review.id,
        star_rating: review.star_rating,
        review_text: review.review_text,
      });

      // Insert review_analyses row
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

      // Insert per-category scores
      if (analysis.categories.length > 0) {
        const categoryRows = analysis.categories.map((c) => ({
          tenant_id: review.tenant_id,
          analysis_id: analysisRow.id,
          review_id: review.id,
          category: c.category,
          sentiment_score: c.sentiment_score,
          confidence: c.confidence,
        }));

        const { error: catErr } = await supabase
          .from("review_categories")
          .insert(categoryRows);

        if (catErr) throw new Error(catErr.message);
      }

      results.push({ review_id: review.id, success: true });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Analysis failed for review ${review.id}:`, msg);
      results.push({ review_id: review.id, success: false, error: msg });
    }
  }

  const succeeded = results.filter((r) => r.success).length;

  // Both of these run via after() — a plain un-awaited fetch() gets cut
  // off when the serverless function tears down right after the response
  // is sent, so the self-chain and rollup trigger below would silently
  // never happen otherwise.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // If we processed a full batch, there may be more — re-queue
  if (pending.length === BATCH_SIZE) {
    after(() =>
      fetch(`${appUrl}/api/reviews/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET ?? "",
        },
        body: JSON.stringify({ trigger: "post_sync" }),
      }).catch(() => {})
    );
  }

  // Trigger rollup recomputation
  if (succeeded > 0) {
    after(() =>
      fetch(`${appUrl}/api/rollup/compute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": CRON_SECRET ?? "",
        },
        body: JSON.stringify({ trigger: "post_analysis" }),
      }).catch(() => {})
    );
  }

  return NextResponse.json({ analyzed: succeeded, total: pending.length, results });
}
