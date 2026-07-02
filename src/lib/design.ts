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
 * Diverging heatmap ramp for scores in [-1, 1] — deep poles validated
 * (worst adjacent CVD ΔE 18.2, both ≥3:1 on #fffdf8).
 * Light mid-steps recede toward the surface (sequential-encoding rule);
 * every cell renders its numeric value, so no cell is color-alone.
 */
export const HEAT_RAMP = [
  "#b92e20", "#e07a5f", "#f3cbba", "#eceadf", "#c2ddcf", "#5ea88b", "#0a7150",
] as const;

export function heatStep(score: number): { bg: string; ink: string } {
  if (score <= -0.5) return { bg: HEAT_RAMP[0], ink: "#fff6f2" };
  if (score <= -0.2) return { bg: HEAT_RAMP[1], ink: "#3a1109" };
  if (score < 0) return { bg: HEAT_RAMP[2], ink: "#3a1109" };
  if (score < 0.2) return { bg: HEAT_RAMP[3], ink: "#5f594c" };
  if (score < 0.5) return { bg: HEAT_RAMP[4], ink: "#0c3122" };
  if (score < 0.75) return { bg: HEAT_RAMP[5], ink: "#0c3122" };
  return { bg: HEAT_RAMP[6], ink: "#f2faf6" };
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
