"use client";

import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SentimentCategory } from "@/types";
import { MOCK_LOCATIONS, MOCK_ROLLUPS } from "@/lib/mock-data";

const CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];
const CATEGORY_LABELS: Record<SentimentCategory, string> = {
  food: "Food", service: "Service", atmosphere: "Atmosphere",
  value: "Value", wait_time: "Wait", cleanliness: "Clean",
};

function ScoreCell({ score, delta }: { score: number | null; delta: number | null }) {
  if (score === null) return <span className="text-zinc-300 text-xs">—</span>;
  const color = score >= 0.2 ? "text-emerald-600" : score >= -0.1 ? "text-amber-600" : "text-red-600";
  const bg = score >= 0.2 ? "bg-emerald-50" : score >= -0.1 ? "bg-amber-50" : "bg-red-50";
  const TrendIcon = delta === null ? null : delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
  const trendColor = delta === null ? "" : delta > 0.05 ? "text-emerald-500" : delta < -0.05 ? "text-red-500" : "text-zinc-400";
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${bg}`}>
      <span className={`text-xs font-semibold ${color}`}>
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </span>
      {TrendIcon && <TrendIcon className={`w-3 h-3 ${trendColor}`} />}
    </div>
  );
}

export default function LocationsPage() {
  // Find the weakest category per location
  const weakestByLocation: Record<string, SentimentCategory> = {};
  for (const loc of MOCK_LOCATIONS) {
    const scores = CATEGORIES.map((cat) => ({
      cat,
      score: MOCK_ROLLUPS.find((r) => r.category === cat)?.avg_sentiment_score ?? 0,
    }));
    const worst = scores.sort((a, b) => a.score - b.score)[0];
    weakestByLocation[loc.id] = worst.cat;
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Locations</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Cross-location sentiment comparison — find your weak link
        </p>
      </div>

      {/* Location cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {MOCK_LOCATIONS.map((loc) => {
          const weakest = weakestByLocation[loc.id];
          return (
            <div key={loc.id} className="bg-white rounded-xl border border-zinc-100 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900 text-sm">{loc.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{loc.address}</p>
                </div>
                {loc.connection_broken && (
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-2xl font-bold text-amber-500">
                    {loc.rating?.toFixed(1) ?? "—"}★
                  </p>
                  <p className="text-xs text-zinc-400">{loc.review_count} reviews</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-50">
                <p className="text-xs text-zinc-500 mb-1">Biggest weak spot</p>
                <Badge className="bg-red-50 text-red-700 border-red-100 text-xs">
                  {CATEGORY_LABELS[weakest]}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-location comparison table */}
      <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Sentiment by Category</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            90-day average · Red = below −0.2 (investigate) · Green = above +0.2 (protect)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 w-40">
                  Location
                </th>
                {CATEGORIES.map((cat) => (
                  <th key={cat} className="text-center px-3 py-3 text-xs font-medium text-zinc-500">
                    {CATEGORY_LABELS[cat]}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-medium text-zinc-500">
                  Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_LOCATIONS.map((loc, i) => (
                <tr
                  key={loc.id}
                  className={`border-b border-zinc-50 ${i % 2 === 0 ? "" : "bg-zinc-50/50"}`}
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900 text-xs">{loc.name}</p>
                  </td>
                  {CATEGORIES.map((cat) => {
                    const rollup = MOCK_ROLLUPS.find((r) => r.category === cat);
                    // Vary scores slightly per location for realistic display
                    const variance = (loc.id === "loc-2" ? -0.2 : loc.id === "loc-3" ? 0.15 : 0);
                    const score = rollup
                      ? Math.max(-1, Math.min(1, (rollup.avg_sentiment_score ?? 0) + variance))
                      : null;
                    return (
                      <td key={cat} className="px-3 py-4 text-center">
                        <ScoreCell score={score} delta={rollup?.sentiment_delta ?? null} />
                      </td>
                    );
                  })}
                  <td className="px-3 py-4 text-center">
                    <span className="text-sm font-semibold text-amber-500">
                      {loc.rating?.toFixed(1) ?? "—"}★
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
