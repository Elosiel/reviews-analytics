"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_LABELS, fmtScore } from "@/lib/design";
import { MOCK_LOCATIONS, MOCK_MATRIX } from "@/lib/mock-data";
import CrossLocationHeatmap from "@/components/dashboard/CrossLocationHeatmap";

export default function LocationsPage() {
  // Weakest category per location (drives the location cards)
  const weakestByLocation: Record<string, (typeof CATEGORIES)[number]> = {};
  for (const loc of MOCK_LOCATIONS) {
    weakestByLocation[loc.id] = CATEGORIES.reduce((worst, cat) =>
      MOCK_MATRIX[loc.id][cat].score < MOCK_MATRIX[loc.id][worst].score
        ? cat
        : worst
    );
  }

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto space-y-7">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          Cross-location comparison
        </p>
        <h1 className="font-heading text-[28px] font-semibold text-ink mt-1.5">
          Which location is the weak link — and on what?
        </h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-xl">
          Same menu, same standards, three different guest experiences. Darker
          red means guests are unhappier; darker green means it&apos;s a
          strength to protect.
        </p>
      </div>

      {/* ── Location cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MOCK_LOCATIONS.map((loc) => {
          const weakest = weakestByLocation[loc.id];
          const weakScore = MOCK_MATRIX[loc.id][weakest].score;
          return (
            <div
              key={loc.id}
              className="bg-paper rounded-2xl border border-line p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-base font-semibold text-ink">
                    {loc.name}
                  </p>
                  <p className="text-xs text-ink-faint mt-0.5">{loc.address}</p>
                </div>
                {loc.connection_broken && (
                  <AlertTriangle className="w-4 h-4 text-neg shrink-0" />
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-ink tabular-nums">
                  {loc.rating?.toFixed(1) ?? "—"}
                  <span className="text-gold text-lg ml-0.5">★</span>
                </p>
                <p className="text-xs text-ink-faint">
                  {loc.review_count} reviews
                </p>
              </div>
              <div className="pt-2.5 border-t border-line-soft flex items-center justify-between">
                <p className="text-xs text-ink-faint">Weakest category</p>
                <span
                  className={cn(
                    "text-xs font-semibold rounded-full px-2.5 py-1",
                    weakScore < -0.2
                      ? "bg-[#fbeeea] text-neg"
                      : "bg-line-soft text-ink-soft"
                  )}
                >
                  {CATEGORY_LABELS[weakest]} {fmtScore(weakScore)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── The heatmap ── */}
      <CrossLocationHeatmap />

      <p className="text-xs text-ink-soft">
        <span className="inline-block w-3 h-3 rounded ring-2 ring-neg/60 mr-1.5 align-[-1px]" />
        Outlined cells are the weakest location for that category — start your
        next ops conversation there.
      </p>
    </div>
  );
}
