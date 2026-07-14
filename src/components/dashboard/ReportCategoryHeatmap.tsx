"use client";

import { CATEGORIES, CATEGORY_LABELS, HEAT_RAMP, fmtScore, heatStep } from "@/lib/design";
import { cn } from "@/lib/utils";
import type { MatrixCell, ReportLocationRanking, SentimentCategory } from "@/types";

/**
 * The report's version of the Overview dashboard's cross-location
 * heatmap — same 90-day snapshot, same diverging scale, same
 * weakest-cell-outlined convention, adapted to the report's own
 * location shape (ReportLocationRanking, not a full Location row) since
 * a saved report doesn't carry the location's live rating/review_count.
 */
export default function ReportCategoryHeatmap({
  locationRankings,
  matrix,
}: {
  locationRankings: ReportLocationRanking[];
  matrix: Record<string, Record<SentimentCategory, MatrixCell>>;
}) {
  if (locationRankings.length === 0 || Object.keys(matrix).length === 0) return null;

  const cellFor = (locationId: string, cat: SentimentCategory): MatrixCell =>
    matrix[locationId]?.[cat] ?? { score: 0, delta: 0, mentions: 0 };

  const weakestPerCategory: Record<SentimentCategory, string> = {} as Record<SentimentCategory, string>;
  for (const cat of CATEGORIES) {
    let worst = locationRankings[0]?.location_id;
    for (const loc of locationRankings) {
      if (cellFor(loc.location_id, cat).score < cellFor(worst, cat).score) worst = loc.location_id;
    }
    weakestPerCategory[cat] = worst;
  }

  const groupAvg = (cat: SentimentCategory) =>
    locationRankings.length === 0
      ? 0
      : locationRankings.reduce((s, l) => s + cellFor(l.location_id, cat).score, 0) / locationRankings.length;

  return (
    <div>
      <div className="flex items-end justify-between gap-3 flex-wrap mb-2.5">
        <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em]">
          Every Location, Every Category
        </p>
        <div className="flex items-center gap-1 text-[10px] text-ink-faint">
          <span>Unhappy</span>
          {HEAT_RAMP.map((c) => (
            <span key={c} className="w-3 h-2.5 rounded-[2px] inline-block" style={{ backgroundColor: c }} />
          ))}
          <span>Delighted</span>
        </div>
      </div>
      <p className="text-xs text-ink-faint mb-3">
        90-day snapshot as of this report, from the same rollups the Overview dashboard uses. Outlined cells are the weakest location for that category.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line-soft bg-cream">
        <table className="w-full text-sm border-separate border-spacing-0.5 p-2">
          <thead>
            <tr>
              <th className="text-left px-2 py-1.5 text-[10px] uppercase tracking-[0.1em] font-medium text-ink-faint">
                Location
              </th>
              {CATEGORIES.map((cat) => (
                <th
                  key={cat}
                  className="text-center px-1 py-1.5 text-[10px] uppercase tracking-[0.1em] font-medium text-ink-faint"
                >
                  {CATEGORY_LABELS[cat]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locationRankings.map((loc) => (
              <tr key={loc.location_id}>
                <td className="px-2 py-1">
                  <p className="font-medium text-ink text-[12px]">{loc.location_name}</p>
                </td>
                {CATEGORIES.map((cat) => {
                  const cell = cellFor(loc.location_id, cat);
                  const step = heatStep(cell.score);
                  const isWeakest = weakestPerCategory[cat] === loc.location_id && cell.score < 0;
                  return (
                    <td key={cat} className="p-0">
                      <div
                        className={cn(
                          "rounded-lg mx-0.5 my-0.5 h-12 flex flex-col items-center justify-center",
                          isWeakest && "ring-2 ring-neg/60 ring-offset-1 ring-offset-cream"
                        )}
                        style={{ backgroundColor: step.bg }}
                      >
                        <span className="text-[12px] font-bold tabular-nums" style={{ color: step.ink }}>
                          {fmtScore(cell.score)}
                        </span>
                        <span className="text-[9px] tabular-nums opacity-75" style={{ color: step.ink }}>
                          {cell.mentions} mention{cell.mentions !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="px-2 py-1.5 border-t border-line-soft">
                <p className="text-[10px] uppercase tracking-[0.1em] font-medium text-ink-faint">Group average</p>
              </td>
              {CATEGORIES.map((cat) => {
                const avg = groupAvg(cat);
                return (
                  <td key={cat} className="text-center border-t border-line-soft pt-1.5">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: avg >= 0.2 ? "#0b7d5a" : avg <= -0.2 ? "#c73527" : "#5f594c" }}
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
