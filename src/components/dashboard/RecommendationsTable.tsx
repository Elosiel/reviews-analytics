"use client";

import { useMemo, useState } from "react";
import { Check, MapPin, Printer, Sparkles } from "lucide-react";
import type { RankedIssue, AlertSeverity } from "@/types";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, SEVERITY_STYLE, fmtScore, scoreInk } from "@/lib/design";

// Urgency order for the to-do list — high first, unranked last.
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function rowKey(i: RankedIssue) {
  return `${i.category}-${i.location_id}`;
}

function PriorityPill({ severity }: { severity: AlertSeverity | null }) {
  if (!severity) {
    return (
      <span className="text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-line-soft text-ink-faint">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5",
        SEVERITY_STYLE[severity].badge
      )}
    >
      {SEVERITY_STYLE[severity].label}
    </span>
  );
}

interface RecommendationsTableProps {
  issues: RankedIssue[];
  onExport?: (issue: RankedIssue) => void;
}

/**
 * The consolidated to-do list — every recommendation across the filtered
 * locations, ranked by urgency, checkable like a task list. Read-only product:
 * this is advice the owner works through, never an action we take for them.
 */
export default function RecommendationsTable({
  issues,
  onExport,
}: RecommendationsTableProps) {
  const [done, setDone] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () =>
      issues
        .filter((i) => i.recommendation)
        .sort(
          (a, b) =>
            (a.severity ? SEVERITY_RANK[a.severity] : 3) -
              (b.severity ? SEVERITY_RANK[b.severity] : 3) ||
            b.mention_count - a.mention_count
        ),
    [issues]
  );

  function toggle(k: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const doneCount = rows.filter((r) => done.has(rowKey(r))).length;
  const allDone = rows.length > 0 && doneCount === rows.length;

  if (rows.length === 0) {
    return (
      <p className="text-center py-12 text-sm text-ink-faint">
        No recommendations for this selection. Nothing on the list — enjoy it.
      </p>
    );
  }

  return (
    <div className="bg-paper rounded-2xl border border-line overflow-hidden">
      {/* Header strip with progress */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line bg-[#faf8f2]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-forest shrink-0" />
          <h3 className="font-heading text-[15px] font-semibold text-ink shrink-0">
            Your to-do list
          </h3>
          <span className="text-xs text-ink-faint truncate hidden sm:inline">
            grounded in what guests are saying, ranked by urgency
          </span>
        </div>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums shrink-0 rounded-full px-2.5 py-1",
            allDone ? "bg-[#eef6f1] text-pos" : "bg-line-soft text-ink-soft"
          )}
        >
          {allDone ? "All clear ✓" : `${doneCount}/${rows.length} done`}
        </span>
      </div>

      {/* Column headers (desktop) */}
      <div className="hidden md:grid grid-cols-[2.25rem_6rem_11rem_1fr_2.75rem] items-center gap-3 px-5 py-2.5 border-b border-line text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
        <span aria-hidden />
        <span>Priority</span>
        <span>Where</span>
        <span>Recommended action</span>
        <span className="text-right">Brief</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-line">
        {rows.map((issue) => {
          const k = rowKey(issue);
          const isDone = done.has(k);
          return (
            <div
              key={k}
              className={cn(
                "px-5 py-4 transition-colors md:grid md:grid-cols-[2.25rem_6rem_11rem_1fr_2.75rem] md:items-start md:gap-3",
                isDone ? "bg-[#faf9f4]" : "hover:bg-[#fbfaf5]"
              )}
            >
              {/* Checkbox — on mobile it shares a row with the priority pill */}
              <div className="flex items-center gap-3 mb-2.5 md:mb-0 md:block">
                <button
                  onClick={() => toggle(k)}
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={isDone ? "Mark as not done" : "Mark as done"}
                  className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                    isDone
                      ? "bg-forest border-forest text-paper"
                      : "bg-paper border-ink-faint/40 hover:border-forest"
                  )}
                >
                  {isDone && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
                <div className="md:hidden">
                  <PriorityPill severity={issue.severity} />
                </div>
              </div>

              {/* Priority (desktop column) */}
              <div className="hidden md:block pt-0.5">
                <PriorityPill severity={issue.severity} />
              </div>

              {/* Where */}
              <div className="mb-2 md:mb-0 min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-sm text-ink">
                  <MapPin className="w-3.5 h-3.5 text-ink-faint shrink-0" />
                  <span className="truncate">{issue.location_name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint flex-wrap">
                  <span className="font-medium text-ink-soft">
                    {CATEGORY_LABELS[issue.category]}
                  </span>
                  <span>·</span>
                  <span>{issue.mention_count} mentions</span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: scoreInk(issue.avg_sentiment_score) }}
                  >
                    {fmtScore(issue.avg_sentiment_score)}
                  </span>
                </div>
              </div>

              {/* Recommended action */}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm leading-relaxed transition-colors",
                    isDone
                      ? "text-ink-faint line-through decoration-ink-faint/40"
                      : "text-ink-soft"
                  )}
                >
                  {issue.recommendation}
                </p>
              </div>

              {/* Brief export */}
              <div className="mt-2.5 md:mt-0 md:text-right">
                {onExport && (
                  <button
                    onClick={() => onExport(issue)}
                    title="Print for tonight's shift meeting"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint hover:text-forest transition-colors md:justify-end"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="md:hidden">Shift brief</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
