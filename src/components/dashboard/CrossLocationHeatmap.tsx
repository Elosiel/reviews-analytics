"use client";

import { useState } from "react";
import type { SentimentCategory } from "@/types";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  HEAT_RAMP,
  fmtScore,
  heatStep,
} from "@/lib/design";
import { MOCK_LOCATIONS, MOCK_MATRIX } from "@/lib/mock-data";

interface HoverCell {
  locId: string;
  cat: SentimentCategory;
}

/**
 * The moat view: category × location sentiment grid.
 * Diverging validated scale; every cell carries its number (never
 * color-alone); weakest negative cell per category is outlined.
 */
export default function CrossLocationHeatmap({
  onSelectLocation,
}: {
  onSelectLocation?: (locationId: string) => void;
}) {
  const [hover, setHover] = useState<HoverCell | null>(null);

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

  const groupAvg = (cat: SentimentCategory) =>
    MOCK_LOCATIONS.reduce((s, l) => s + MOCK_MATRIX[l.id][cat].score, 0) /
    MOCK_LOCATIONS.length;

  return (
    <div className="bg-paper rounded-2xl border border-line overflow-hidden">
      <div className="px-6 py-5 border-b border-line-soft flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">
            Every location, every category
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Average AI sentiment (−1 to +1) over the last 90 days. Outlined
            cells are the weakest location for that category.
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span>Unhappy</span>
          {HEAT_RAMP.map((c) => (
            <span
              key={c}
              className="w-4 h-3 rounded-[3px] inline-block"
              style={{ backgroundColor: c }}
            />
          ))}
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
                  <button
                    onClick={() => onSelectLocation?.(loc.id)}
                    className={cn(
                      "text-left",
                      onSelectLocation && "hover:underline underline-offset-2"
                    )}
                  >
                    <p className="font-medium text-ink text-[13px]">
                      {loc.name}
                    </p>
                    <p className="text-[11px] text-ink-faint tabular-nums">
                      {loc.rating?.toFixed(1)}★ · {loc.review_count} reviews
                    </p>
                  </button>
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
                          isWeakest &&
                            "ring-2 ring-neg/60 ring-offset-1 ring-offset-paper",
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
    </div>
  );
}
