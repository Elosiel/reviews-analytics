"use client";

import { ChevronRight, CalendarDays, TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";
import { fmtScore } from "@/lib/design";
import type { WeeklyReport } from "@/types";

function fmtDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const TREND_ICON = { improving: TrendingUp, declining: TrendingDown, flat: Minus };

interface ReportHistoryCardProps {
  report: WeeklyReport;
  onOpen: () => void;
}

export default function ReportHistoryCard({ report, onOpen }: ReportHistoryCardProps) {
  const leader = report.location_rankings[0];
  const weakest = report.location_rankings[report.location_rankings.length - 1];
  const TrendIcon = leader ? TREND_ICON[leader.trend] : Minus;

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left bg-paper rounded-2xl border p-5 transition-all hover:border-ink-faint ${
        report.needs_attention.length > 0 ? "border-neg/30" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading text-base font-semibold text-ink">
              {fmtDate(report.period_start)} – {fmtDate(report.period_end)}
            </p>
            {report.needs_attention.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide bg-neg text-paper rounded-full px-2 py-0.5">
                <ShieldAlert className="w-3 h-3" />
                {report.needs_attention.length} needs attention
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-ink-faint">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {report.location_rankings.length} location{report.location_rankings.length !== 1 ? "s" : ""}
            </span>
            {leader && (
              <span className="flex items-center gap-1 text-ink-soft font-medium">
                <TrendIcon className="w-3 h-3" />
                {leader.location_name} leading ({fmtScore(leader.composite_score)})
              </span>
            )}
            {weakest && weakest.location_id !== leader?.location_id && (
              <span>{weakest.location_name} needs attention</span>
            )}
            <span>{report.recommended_actions.length} action{report.recommended_actions.length !== 1 ? "s" : ""}</span>
            {!report.ai_generated && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-line-soft text-ink-faint rounded-full px-2 py-0.5">
                Non-AI
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-faint shrink-0 mt-1" />
      </div>
    </button>
  );
}
