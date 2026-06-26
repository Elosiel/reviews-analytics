"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import type { DriftAlert, SentimentCategory } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<SentimentCategory, string> = {
  food: "Food",
  service: "Service",
  atmosphere: "Atmosphere",
  value: "Value",
  wait_time: "Wait Time",
  cleanliness: "Cleanliness",
};

const SEVERITY_STYLES = {
  high: {
    banner: "bg-red-50 border-red-200",
    icon: "text-red-500",
    title: "text-red-800",
    body: "text-red-700",
    badge: "bg-red-100 text-red-700",
  },
  medium: {
    banner: "bg-amber-50 border-amber-200",
    icon: "text-amber-500",
    title: "text-amber-800",
    body: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  low: {
    banner: "bg-zinc-50 border-zinc-200",
    icon: "text-zinc-500",
    title: "text-zinc-800",
    body: "text-zinc-600",
    badge: "bg-zinc-100 text-zinc-600",
  },
};

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
        const s = SEVERITY_STYLES[alert.severity];
        const locationName = locationNames[alert.location_id] ?? "Unknown";
        const detectedDate = new Date(alert.detected_at).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" }
        );

        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              s.banner
            )}
          >
            <AlertTriangle
              className={cn("w-4 h-4 mt-0.5 shrink-0", s.icon)}
            />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-sm font-semibold", s.title)}>
                  {CATEGORY_LABELS[alert.category]} — {locationName}
                </span>
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded font-medium",
                    s.badge
                  )}
                >
                  {alert.severity} drift
                </span>
                <span className="text-xs text-zinc-400">
                  Detected {detectedDate}
                </span>
              </div>
              <p className={cn("text-sm", s.body)}>{alert.message}</p>
              <p className="text-xs text-zinc-400">
                Score:{" "}
                <span className="font-medium">
                  {alert.score_before > 0 ? "+" : ""}
                  {alert.score_before.toFixed(2)}
                </span>{" "}
                →{" "}
                <span className="font-medium text-red-600">
                  {alert.score_after > 0 ? "+" : ""}
                  {alert.score_after.toFixed(2)}
                </span>{" "}
                ({alert.delta > 0 ? "+" : ""}
                {alert.delta.toFixed(2)})
              </p>
            </div>
            <button
              onClick={() =>
                setDismissed((prev) => new Set([...prev, alert.id]))
              }
              className="text-zinc-400 hover:text-zinc-600 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
