"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Location } from "@/types";
import type { AnalysisState } from "@/lib/data/analysis-status";

const REFRESH_MS = 15_000;

interface Copy {
  title: string;
  body: string;
  action?: { label: string; run: () => Promise<string | null> };
}

async function postJson(url: string, body: object): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Returns an error message, or null when the import ran cleanly.
async function importReviews(): Promise<string | null> {
  const res = await postJson("/api/reviews/sync", { trigger: "manual" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return "We couldn't start the import. Try again in a moment.";
  if (data.no_locations) return "The Google connection needs to be renewed before we can import. Reconnect Google above.";
  const failed = (data.results ?? []).find((r: { error?: string }) => r.error);
  return failed ? `${failed.location_name}: ${failed.error}` : null;
}

async function resumeAnalysis(): Promise<string | null> {
  const res = await postJson("/api/reviews/analyze", { trigger: "manual" });
  return res.ok ? null : "We couldn't restart analysis. Try again in a moment.";
}

function copyFor(a: AnalysisState): Copy | null {
  const starOnly = a.totalReviews - a.analyzable;
  const starOnlyNote =
    starOnly > 0 ? ` ${starOnly} star-only review${starOnly !== 1 ? "s have" : " has"} no text to analyze.` : "";

  switch (a.kind) {
    case "ready":
      return null;
    case "not_imported":
      return {
        title: "Connected — your first import hasn't run yet",
        body: "Your locations are connected to Google, but we haven't pulled their reviews yet.",
        action: { label: "Import reviews now", run: importReviews },
      };
    case "no_reviews":
      return {
        title: "Connected — no reviews on Google yet",
        body: "Your locations don't have any reviews on Google yet. We check for new ones every 6 hours, and they'll show up here automatically.",
      };
    case "analyzing":
      return {
        title: `Analyzing your reviews — ${a.analyzed} of ${a.analyzable} done`,
        body: `Your reviews are imported and listed under All reviews. Rankings, the heatmap, and trends fill in as analysis finishes — this page updates on its own.${starOnlyNote}`,
      };
    case "stalled":
      return {
        title: `Analysis paused at ${a.analyzed} of ${a.analyzable}`,
        body: "Analysis stopped making progress. Your imported reviews are safe — resume it here, or it restarts on its own with the next sync (within 6 hours).",
        action: { label: "Resume analysis", run: resumeAnalysis },
      };
    case "finishing":
      return {
        title: `All ${a.analyzable} reviews analyzed — building your rankings`,
        body: "This takes a moment. The page updates on its own.",
      };
    case "nothing_to_rank":
      return {
        title: "Your reviews are analyzed — nothing recent enough to rank yet",
        body: `Rankings and trends cover the last 90 days, and there isn't enough recent written feedback yet. Your full history is under All reviews, and new reviews are checked every 6 hours.${starOnlyNote}`,
      };
  }
}

/**
 * What's real right now for a connected account: Google's own rating and
 * review totals (saved at sync time), plus where the analysis pipeline is.
 * Shown until the ranked views have something to show — so an empty widget
 * never reads as "nothing to report", and a broken connection is never
 * hidden behind stale numbers.
 */
export default function ConnectionStatusBanner({
  analysis,
  locations,
}: {
  analysis: AnalysisState;
  locations: Location[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const autoRefresh = analysis.kind === "analyzing" || analysis.kind === "finishing";
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, router]);

  const broken = locations.filter((l) => l.connection_broken);
  const copy = copyFor(analysis);
  if (!copy && broken.length === 0) return null;

  // Google's own average, weighted by its review totals — both saved at
  // sync time, so a location not re-synced since that started has no rating.
  const rated = locations.filter((l) => l.rating !== null && (l.review_count ?? 0) > 0);
  const ratedReviews = rated.reduce((sum, l) => sum + l.review_count, 0);
  const avgRating =
    ratedReviews > 0 ? rated.reduce((sum, l) => sum + (l.rating ?? 0) * l.review_count, 0) / ratedReviews : null;
  const progress = analysis.analyzable > 0 ? analysis.analyzed / analysis.analyzable : 0;

  async function runAction(run: () => Promise<string | null>) {
    setRunning(true);
    setActionError(null);
    try {
      const err = await run();
      if (err) setActionError(err);
      router.refresh();
    } catch {
      setActionError("Something went wrong. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      {broken.length > 0 && (
        <div className="rounded-2xl border-2 border-neg/40 bg-[#fbeeea] p-5 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-neg shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-heading text-base font-semibold text-[#7a1f13]">
              Google stopped accepting our access
            </p>
            <p className="text-sm text-[#66261a] mt-1">
              {`We can't read new reviews for ${broken.map((l) => l.name).join(", ")} until you reconnect. What's shown below may be out of date.`}
            </p>
          </div>
          <a
            href="/api/google/connect"
            className="shrink-0 rounded-lg bg-neg text-paper text-sm font-medium px-4 py-2 hover:opacity-90"
          >
            Reconnect Google
          </a>
        </div>
      )}

      {copy && (
        <div className="rounded-2xl border border-line bg-paper p-6 space-y-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint font-medium">
            {locations.length} location{locations.length !== 1 ? "s" : ""} connected to Google
            {" · "}
            {analysis.totalReviews} review{analysis.totalReviews !== 1 ? "s" : ""} imported
            {avgRating !== null && ` · ${avgRating.toFixed(1)}★ average on Google`}
          </p>
          <div>
            <p className="font-heading text-lg font-semibold text-ink">{copy.title}</p>
            <p className="text-sm text-ink-soft mt-1 leading-relaxed">{copy.body}</p>
          </div>
          {(analysis.kind === "analyzing" || analysis.kind === "stalled") && (
            <div
              className="h-1.5 rounded-full bg-line-soft overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={analysis.analyzable}
              aria-valuenow={analysis.analyzed}
            >
              <div className="h-full bg-forest transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {copy.action && (
            <button
              onClick={() => runAction(copy.action!.run)}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-forest text-paper text-sm font-medium px-4 py-2 hover:bg-forest-soft disabled:opacity-60"
            >
              {running && <Loader2 className="w-4 h-4 animate-spin" />}
              {copy.action.label}
            </button>
          )}
          {actionError && <p className="text-sm text-neg">{actionError}</p>}
        </div>
      )}
    </div>
  );
}
