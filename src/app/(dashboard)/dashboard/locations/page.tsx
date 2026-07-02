"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { SentimentCategory } from "@/types";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  fmtScore,
  heatStep,
} from "@/lib/design";
import { MOCK_LOCATIONS, MOCK_MATRIX } from "@/lib/mock-data";

interface HoverCell {
  locId: string;
  cat: SentimentCategory;
}

export default function LocationsPage() {
  const [hover, setHover] = useState<HoverCell | null>(null);

  // Weakest location per category (the row-by-row "who's dragging us")
  const weakestPerCategory: Record<SentimentCategory, string> = {} as Record<
    SentimentCategory,
    string
  >;
  for (const cat of CATEGORIES) {
    let worst = MOCK_LOCATIONS[0].id;
    for (const loc of MOCK_LOCATIONS) {
      if (MOCK_MATRIX[loc.id][cat].score < MOCK_MATRIX[worst][cat].score) {
        worst = loc.id;
      }
    }
    weakestPerCategory[cat] = worst;
  }

  // Weakest category per location (drives the location cards)
  const weakestByLocation: Record<string, SentimentCategory> = {};
  for (const loc of MOCK_LOCATIONS) {
    weakestByLocation[loc.id] = CATEGORIES.reduce((worst, cat) =>
      MOCK_MATRIX[loc.id][cat].score < MOCK_MATRIX[loc.id][worst].score
        ? cat
        : worst
    );
  }

  const groupAvg = (cat: SentimentCategory) =>
    MOCK_LOCATIONS.reduce((s, l) => s + MOCK_MATRIX[l.id][cat].score, 0) /
    MOCK_LOCATIONS.length;

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
      <div className="bg-paper rounded-2xl border border-line overflow-hidden">
        <div className="px-6 py-5 border-b border-line-soft flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">
              Sentiment by category · last 90 days
            </h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Each cell is the average AI sentiment (−1 to +1) across every
              review that mentioned that category.
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
            <span>Unhappy</span>
            {["#c73527", "#e8917b", "#f5d2c5", "#edeadf", "#c9e0d4", "#6fb197", "#0b7d5a"].map(
              (c) => (
                <span
                  key={c}
                  className="w-4 h-3 rounded-[3px] inline-block"
                  style={{ backgroundColor: c }}
                />
              )
            )}
            <span>Delighted</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0.5 p-3">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.12em] font-medium text-ink-faint w-44">
                  Location
                </th>
                {CATEGORIES.map((cat) => (
                  <th
                    key={cat}
                    className="text-center px-2 py-2 text-[11px] uppercase tracking-[0.12em] font-medium text-ink-faint"
                  >
                    {CATEGORY_LABELS[cat]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_LOCATIONS.map((loc) => (
                <tr key={loc.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-ink text-[13px]">
                      {loc.name}
                    </p>
                    <p className="text-[11px] text-ink-faint tabular-nums">
                      {loc.rating?.toFixed(1)}★ · {loc.review_count} reviews
                    </p>
                  </td>
                  {CATEGORIES.map((cat) => {
                    const cell = MOCK_MATRIX[loc.id][cat];
                    const step = heatStep(cell.score);
                    const isWeakest =
                      weakestPerCategory[cat] === loc.id && cell.score < 0;
                    const isHovered =
                      hover?.locId === loc.id && hover?.cat === cat;
                    return (
                      <td key={cat} className="p-0 relative">
                        <div
                          onMouseEnter={() => setHover({ locId: loc.id, cat })}
                          onMouseLeave={() => setHover(null)}
                          className={cn(
                            "rounded-lg mx-0.5 my-0.5 h-14 flex flex-col items-center justify-center cursor-default transition-shadow",
                            isWeakest && "ring-2 ring-neg/60 ring-offset-1 ring-offset-paper",
                            isHovered && "shadow-md"
                          )}
                          style={{ backgroundColor: step.bg }}
                        >
                          <span
                            className="text-[13px] font-bold tabular-nums"
                            style={{ color: step.ink }}
                          >
                            {fmtScore(cell.score)}
                          </span>
                          <span
                            className="text-[10px] tabular-nums opacity-75"
                            style={{ color: step.ink }}
                          >
                            {cell.mentions} mentions
                          </span>

                          {/* Tooltip */}
                          {isHovered && (
                            <div className="absolute z-10 bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-ink text-paper text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg pointer-events-none">
                              <p className="font-semibold">
                                {CATEGORY_LABELS[cat]} · {loc.name}
                              </p>
                              <p className="opacity-80 tabular-nums">
                                {fmtScore(cell.score)} avg ·{" "}
                                {cell.delta < 0 ? "▼" : "▲"} {fmtScore(cell.delta)}{" "}
                                vs prior · {cell.mentions} mentions
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Group average row */}
              <tr>
                <td className="px-3 py-2 border-t border-line-soft">
                  <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-ink-faint pt-1">
                    Group average
                  </p>
                </td>
                {CATEGORIES.map((cat) => {
                  const avg = groupAvg(cat);
                  return (
                    <td
                      key={cat}
                      className="text-center border-t border-line-soft pt-2"
                    >
                      <span
                        className="text-xs font-bold tabular-nums"
                        style={{
                          color:
                            avg >= 0.2
                              ? "#0b7d5a"
                              : avg <= -0.2
                              ? "#c73527"
                              : "#5f594c",
                        }}
                      >
                        {fmtScore(avg)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3.5 border-t border-line-soft bg-cream/50">
          <p className="text-xs text-ink-soft">
            <span className="inline-block w-3 h-3 rounded ring-2 ring-neg/60 mr-1.5 align-[-1px]" />
            Outlined cells are the weakest location for that category — start
            your next ops conversation there.
          </p>
        </div>
      </div>
    </div>
  );
}
