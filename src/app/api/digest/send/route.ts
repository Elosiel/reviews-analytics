/**
 * POST /api/digest/send
 *
 * Sends the weekly Monday digest email to all tenants.
 * Called by pg_cron at 07:00 UTC every Monday.
 *
 * For each tenant:
 *   1. Read ranked issues from category_rollups (30-day window)
 *   2. Read top positive categories ("what they love")
 *   3. Render HTML email
 *   4. Send via Resend
 *   5. Log result in digest_log
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendDigestEmail } from "@/lib/pipeline/digest-email";
import type { SentimentCategory } from "@/types";

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return !!CRON_SECRET && secret === CRON_SECRET;
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Digest sends across every tenant in one pass — always cron-triggered,
  // never a per-user request, so this always runs as service-role.
  const supabase = createServiceClient();

  // Get all tenants with at least one location
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, tenant_id, email, full_name")
    .not("tenant_id", "is", null);

  if (!profiles?.length) {
    return NextResponse.json({ sent: 0, message: "No tenants found" });
  }

  const weekEnding = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const results: { tenant_id: string; status: "sent" | "failed"; error?: string }[] = [];

  for (const profile of profiles) {
    try {
      // Get locations for this tenant
      const { data: locations } = await supabase
        .from("locations")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id);

      if (!locations?.length) continue;

      const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

      // Get 30-day rollups for all locations of this tenant
      const { data: rollups } = await supabase
        .from("category_rollups")
        .select("location_id, category, avg_sentiment_score, sentiment_delta, mention_count")
        .eq("tenant_id", profile.tenant_id)
        .eq("window_days", 30)
        .order("avg_sentiment_score", { ascending: true });

      if (!rollups?.length) continue;

      // Ranked issues: negative sentiment categories, sorted worst first
      const issues = rollups
        .filter((r) => (r.avg_sentiment_score ?? 0) < 0.1)
        .slice(0, 5)
        .map((r) => {
          const delta = r.sentiment_delta as number | null;
          const severity =
            delta !== null && delta <= -0.4
              ? "high"
              : delta !== null && delta <= -0.2
              ? "medium"
              : delta !== null && delta < 0
              ? "low"
              : null;
          return {
            category: r.category as SentimentCategory,
            location_name: locationMap[r.location_id] ?? "Unknown",
            mention_count: r.mention_count as number,
            avg_sentiment_score: r.avg_sentiment_score as number,
            sentiment_delta: r.sentiment_delta as number | null,
            severity: severity as "high" | "medium" | "low" | null,
          };
        });

      // What they love: positive sentiment, sorted best first
      const loves = rollups
        .filter((r) => (r.avg_sentiment_score ?? 0) >= 0.2)
        .sort((a, b) => (b.avg_sentiment_score ?? 0) - (a.avg_sentiment_score ?? 0))
        .slice(0, 3)
        .map((r) => ({
          category: r.category as SentimentCategory,
          location_name: locationMap[r.location_id] ?? "Unknown",
          mention_count: r.mention_count as number,
          avg_sentiment_score: r.avg_sentiment_score as number,
        }));

      if (issues.length === 0 && loves.length === 0) continue;

      // Send email
      await sendDigestEmail({
        tenant_email: profile.email,
        tenant_name: profile.full_name ?? profile.email,
        week_ending: weekEnding,
        issues,
        loves,
        app_url: APP_URL,
      });

      // Log success
      await supabase.from("digest_log").insert({
        tenant_id: profile.tenant_id,
        email_to: profile.email,
        status: "sent",
      });

      results.push({ tenant_id: profile.tenant_id, status: "sent" });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Digest failed for tenant ${profile.tenant_id}:`, msg);

      await supabase.from("digest_log").insert({
        tenant_id: profile.tenant_id,
        email_to: profile.email,
        status: "failed",
        error_msg: msg.slice(0, 500),
      });

      results.push({ tenant_id: profile.tenant_id, status: "failed", error: msg });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({ sent, total: results.length, results });
}
