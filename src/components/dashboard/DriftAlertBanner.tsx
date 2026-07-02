"use client";

import { TrendingDown, X } from "lucide-react";
import { useState } from "react";
import type { DriftAlert } from "@/types";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, SEVERITY_STYLE, fmtScore } from "@/lib/design";

interface DriftAlertBannerProps {
  alerts: DriftAlert[];
  locationNames: Record<string, string>;
}

export default function DriftAlertBanner({
  alerts,
  locationNames,
}: DriftAlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => {
        const locationName = locationNames[alert.location_id] ?? "Unknown";
        const detectedDate = new Date(alert.detected_at).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" }
        );
        const isHigh = alert.severity === "high";

        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3.5 rounded-2xl border p-4 bg-paper",
              isHigh ? "border-neg/35" : "border-[#e5cf9e]"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                isHigh ? "bg-[#fbeeea]" : "bg-[#faf3e2]"
              )}
            >
              <TrendingDown
                className={cn(
                  "w-4 h-4",
                  isHigh ? "text-neg" : "text-[#a4700f]"
                )}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-ink">
                  {CATEGORY_LABELS[alert.category]} is slipping at{" "}
                  {locationName}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5",
                    SEVERITY_STYLE[alert.severity].badge
                  )}
                >
                  {SEVERITY_STYLE[alert.severity].label} drift
                </span>
                <span className="text-xs text-ink-faint">
                  since {detectedDate}
                </span>
              </div>
              <p className="text-sm text-ink-soft">{alert.message}</p>
              <p className="text-xs text-ink-faint tabular-nums">
                30-day score{" "}
                <span className="font-semibold text-ink-soft">
                  {fmtScore(alert.score_before)}
                </span>{" "}
                →{" "}
                <span className="font-semibold text-neg">
                  {fmtScore(alert.score_after)}
                </span>{" "}
                ({fmtScore(alert.delta)})
              </p>
            </div>
            <button
              onClick={() =>
                setDismissed((prev) => new Set([...prev, alert.id]))
              }
              className="text-ink-faint hover:text-ink shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
