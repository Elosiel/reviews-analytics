"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Download, MapPin } from "lucide-react";
import type { RankedIssue, SentimentCategory } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<SentimentCategory, string> = {
  food: "Food Quality",
  service: "Service",
  atmosphere: "Atmosphere",
  value: "Value",
  wait_time: "Wait Time",
  cleanliness: "Cleanliness",
};

const CATEGORY_EMOJI: Record<SentimentCategory, string> = {
  food: "🍽️",
  service: "👥",
  atmosphere: "✨",
  value: "💰",
  wait_time: "⏱️",
  cleanliness: "🧹",
};

const SEVERITY_STYLES = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

function ScoreBar({ score }: { score: number }) {
  // score: -1 to 1 → position in bar
  const pct = ((score + 1) / 2) * 100;
  const color =
    score >= 0.2 ? "#10b981" : score >= -0.1 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative h-1.5 bg-zinc-100 rounded-full overflow-hidden w-24">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
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
  const [expanded, setExpanded] = useState(false);
  const delta = issue.sentiment_delta;
  const hasDelta = delta !== null && delta !== undefined;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border transition-all",
        issue.severity === "high"
          ? "border-red-200 shadow-sm"
          : issue.severity === "medium"
          ? "border-amber-100"
          : "border-zinc-100"
      )}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-semibold text-zinc-500">{rank}</span>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">
                {CATEGORY_EMOJI[issue.category]}
              </span>
              <span className="font-semibold text-zinc-900">
                {CATEGORY_LABELS[issue.category]}
              </span>
              {issue.severity && (
                <Badge
                  className={cn(
                    "text-xs border",
                    SEVERITY_STYLES[issue.severity]
                  )}
                >
                  {issue.severity}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <MapPin className="w-3 h-3" />
                {issue.location_name}
              </div>
              <span className="text-xs text-zinc-400">
                {issue.mention_count} mention{issue.mention_count !== 1 ? "s" : ""}
              </span>
              {hasDelta && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    delta < 0 ? "text-red-600" : "text-emerald-600"
                  )}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(2)} vs prior period
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ScoreBar score={issue.avg_sentiment_score} />
              <span className="text-xs text-zinc-400">
                {issue.avg_sentiment_score.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {onExport && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-zinc-700"
                onClick={() => onExport(issue)}
                title="Export shift meeting card"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-zinc-700"
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

        {/* Quotes */}
        {expanded && issue.quotes.length > 0 && (
          <div className="mt-4 ml-11 space-y-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Recent guest quotes (last 30 days)
            </p>
            {issue.quotes.map((q, i) => (
              <blockquote
                key={i}
                className="border-l-2 border-zinc-200 pl-3 text-sm text-zinc-600 italic"
              >
                &ldquo;{q}&rdquo;
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
