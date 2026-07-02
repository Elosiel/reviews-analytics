"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MapPin, Printer, Sparkles } from "lucide-react";
import type { RankedIssue } from "@/types";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, SEVERITY_STYLE, fmtScore } from "@/lib/design";

function ScoreBar({ score }: { score: number }) {
  // Diverging bar anchored at the neutral midpoint
  const pct = Math.min(50, Math.abs(score) * 50);
  const isNeg = score < 0;
  return (
    <div className="relative h-1.5 bg-line-soft rounded-full w-28 overflow-hidden">
      <div className="absolute left-1/2 top-0 h-full w-px bg-ink-faint/40" />
      <div
        className={cn(
          "absolute top-0 h-full rounded-full",
          isNeg ? "bg-neg right-1/2" : "bg-pos left-1/2"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface RankedIssueCardProps {
  issue: RankedIssue;
  rank: number;
  onExport?: (issue: RankedIssue) => void;
}

export default function RankedIssueCard({
  issue,
  rank,
  onExport,
}: RankedIssueCardProps) {
  // Top-ranked issue opens with its evidence showing — it's the headline
  const [expanded, setExpanded] = useState(rank === 1);
  const delta = issue.sentiment_delta;
  const isPositive = issue.avg_sentiment_score > 0;

  return (
    <div
      className={cn(
        "bg-paper rounded-2xl border transition-all",
        issue.severity === "high" ? "border-neg/35" : "border-line"
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              rank === 1 && !isPositive
                ? "bg-forest text-paper"
                : "bg-line-soft text-ink-soft"
            )}
          >
            <span className="text-xs font-bold">{rank}</span>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-heading text-lg font-semibold text-ink">
                {CATEGORY_LABELS[issue.category]}
              </span>
              {issue.severity && (
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5",
                    SEVERITY_STYLE[issue.severity].badge
                  )}
                >
                  {SEVERITY_STYLE[issue.severity].label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs">
              <span className="flex items-center gap-1.5 text-ink-soft font-medium">
                <MapPin className="w-3 h-3" />
                {issue.location_name}
              </span>
              <span className="text-ink-faint">
                {issue.mention_count} mention{issue.mention_count !== 1 ? "s" : ""}
              </span>
              {delta !== null && delta !== undefined && (
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    delta < 0 ? "text-neg" : "text-pos"
                  )}
                >
                  {delta < 0 ? "▼" : "▲"} {fmtScore(delta)} vs prior 30 days
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <ScoreBar score={issue.avg_sentiment_score} />
              <span className="text-xs font-semibold text-ink-soft tabular-nums">
                {fmtScore(issue.avg_sentiment_score)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-ink-soft hover:text-ink hover:bg-line-soft gap-1.5 text-xs"
                onClick={() => onExport(issue)}
                title="Print for tonight's shift meeting"
              >
                <Printer className="w-3.5 h-3.5" />
                Shift brief
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-ink-faint hover:text-ink hover:bg-line-soft"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Hide quotes" : "Show quotes"}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Quotes + recommendation */}
        {expanded && (
          <div className="mt-4 ml-12 space-y-4">
            {issue.quotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em]">
                  What guests are saying right now · last 30 days
                </p>
                {issue.quotes.map((q, i) => (
                  <blockquote
                    key={i}
                    className="border-l-2 border-line pl-3 text-sm text-ink-soft italic leading-relaxed"
                  >
                    &ldquo;{q}&rdquo;
                  </blockquote>
                ))}
              </div>
            )}

            {issue.recommendation && (
              <div className="rounded-xl bg-[#f0f4ee] border border-forest/15 p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-forest" />
                  <p className="text-[11px] font-semibold text-forest uppercase tracking-[0.14em]">
                    Our recommendation
                  </p>
                  <span className="text-[10px] text-ink-faint ml-1">
                    based on your restaurant profile
                  </span>
                </div>
                <p className="text-sm text-[#2c3d2f] leading-relaxed">
                  {issue.recommendation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Collapsed: recommendation is always one click away, never hidden */}
        {!expanded && issue.recommendation && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-3 ml-12 flex items-center gap-2 text-left group max-w-full"
          >
            <Sparkles className="w-3.5 h-3.5 text-forest shrink-0" />
            <span className="text-xs text-ink-soft truncate group-hover:text-ink transition-colors">
              <span className="font-semibold text-forest">
                Our recommendation:
              </span>{" "}
              {issue.recommendation}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
