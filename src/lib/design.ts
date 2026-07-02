/**
 * Shared design constants for sentiment display.
 *
 * The diverging sentiment scale (teal ↔ terracotta, warm-neutral midpoint)
 * was validated with the dataviz palette validator: poles #0b7d5a / #c73527,
 * worst adjacent CVD ΔE 18.7 (protan), both ≥3:1 on the #fffdf8 surface.
 * Heatmap cells always carry an in-cell numeric label (the relief rule),
 * so color never carries meaning alone.
 */

import type { SentimentCategory, AlertSeverity } from "@/types";

export const CATEGORIES: SentimentCategory[] = [
  "food",
  "service",
  "atmosphere",
  "value",
  "wait_time",
  "cleanliness",
];

export const CATEGORY_LABELS: Record<SentimentCategory, string> = {
  food: "Food",
  service: "Service",
  atmosphere: "Atmosphere",
  value: "Value",
  wait_time: "Wait Time",
  cleanliness: "Cleanliness",
};

export const POS = "#0b7d5a";
export const NEG = "#c73527";

/** Signed score, e.g. "+0.42" / "−0.31" */
export function fmtScore(score: number): string {
  return `${score > 0 ? "+" : score < 0 ? "−" : ""}${Math.abs(score).toFixed(2)}`;
}

/** Text color for a sentiment score (used beside labels, never alone) */
export function scoreInk(score: number): string {
  if (score >= 0.2) return POS;
  if (score <= -0.2) return NEG;
  return "#5f594c";
}

/**
 * Diverging heatmap step for a score in [-1, 1].
 * Light mid-steps recede toward the surface (sequential-encoding rule);
 * every cell renders its numeric value, so no cell is color-alone.
 */
export function heatStep(score: number): { bg: string; ink: string } {
  if (score <= -0.5) return { bg: "#c73527", ink: "#fffdf8" };
  if (score <= -0.2) return { bg: "#e8917b", ink: "#3d1408" };
  if (score < 0) return { bg: "#f5d2c5", ink: "#3d1408" };
  if (score < 0.2) return { bg: "#edeadf", ink: "#5f594c" };
  if (score < 0.5) return { bg: "#c9e0d4", ink: "#0d3325" };
  if (score < 0.75) return { bg: "#6fb197", ink: "#0d3325" };
  return { bg: "#0b7d5a", ink: "#fffdf8" };
}

/** Status styling for alert severity — icon + label always accompany color */
export const SEVERITY_STYLE: Record<
  AlertSeverity,
  { badge: string; label: string }
> = {
  high: { badge: "bg-[#c73527] text-[#fffdf8]", label: "High" },
  medium: { badge: "bg-[#f4dbb1] text-[#5c430e]", label: "Medium" },
  low: { badge: "bg-[#edeadf] text-[#5f594c]", label: "Low" },
};
