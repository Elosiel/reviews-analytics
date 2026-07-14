/**
 * Weekly report → email draft.
 *
 * Pre-fills a subject + plaintext body into a Gmail compose window so the
 * owner can review and send it themselves — there's no server-side send
 * for reports (that's an intentional v1 non-goal, see the Reports page
 * copy). Gmail's compose deep link (mail.google.com/mail/?view=cm) only
 * accepts a plain-text body — there's no way to inject the app's styled
 * HTML through that URL, so this leans on section headers, dividers, and
 * a few unicode glyphs (▲▼ for trend, a bullet for good/bad) to keep the
 * same green-vs-red-at-a-glance structure as the PDF/UI within that
 * constraint. The UI says so before opening the window.
 */

import { CATEGORIES, CATEGORY_LABELS } from "@/lib/design";
import type { DangerFlag, ReportQuoteSnapshot, WeeklyReport } from "@/types";

const FLAG_LABELS: Record<DangerFlag, string> = {
  health_safety: "Health & safety",
  legal: "Legal",
  discrimination: "Discrimination",
  physical_safety: "Physical safety",
};

const TREND_ARROW: Record<WeeklyReport["location_rankings"][number]["trend"], string> = {
  improving: "▲",
  declining: "▼",
  flat: "–",
};

function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function fmtDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sectionHeader(title: string): string {
  return `${title}\n${"─".repeat(title.length)}`;
}

// Same group-average calc as ReportCategoryHeatmap.tsx / categoryMatrixHtml()
// in weekly-report-html.ts — the heatmap's headline number, in a form
// plain text can actually carry.
function categoryGroupAverages(report: WeeklyReport): string[] {
  const locations = report.location_rankings;
  if (locations.length === 0 || Object.keys(report.category_matrix).length === 0) return [];
  return CATEGORIES.map((cat) => {
    const avg =
      locations.reduce((s, l) => s + (report.category_matrix[l.location_id]?.[cat]?.score ?? 0), 0) /
      locations.length;
    return `${CATEGORY_LABELS[cat]} ${fmtSigned(avg)}`;
  });
}

export function weeklyReportEmailSubject(report: WeeklyReport): string {
  const urgent = report.needs_attention.length > 0 ? "⚠ " : "";
  return `${urgent}Weekly report — ${fmtDate(report.period_start)} to ${fmtDate(report.period_end)}`;
}

export function weeklyReportEmailBody(report: WeeklyReport, quotes: ReportQuoteSnapshot[] = []): string {
  const parts: string[] = [];

  parts.push(`WEEKLY REPORT — ${fmtDate(report.period_start)} to ${fmtDate(report.period_end)}`);
  parts.push("");
  parts.push(
    "How to read these scores: every number below is an AI sentiment rating from -1.0 (very negative) to +1.0 (very positive) — not a star rating. It's the average across only the reviews that mentioned that specific topic, from the batch of reviews currently synced into this system."
  );
  parts.push("");
  parts.push(report.executive_summary);

  if (report.needs_attention.length > 0) {
    parts.push("");
    parts.push(sectionHeader("⚠ NEEDS YOUR ATTENTION TODAY"));
    for (const item of report.needs_attention) {
      const quote = quotes.find((q) => q.theme_kind === "danger" && q.review_id === item.review_id);
      parts.push(
        `- [${FLAG_LABELS[item.flag]}] ${item.location_name} · ${item.star_rating}★` +
          (quote?.quote_text ? `\n  "${quote.quote_text}"` : "")
      );
    }
  }

  if (report.location_rankings.length > 0) {
    parts.push("");
    parts.push(sectionHeader("LOCATION RANKING"));
    parts.push(
      report.location_rankings
        .map((l) => `${l.rank}. ${l.location_name} — ${fmtSigned(l.composite_score)} ${TREND_ARROW[l.trend]} ${l.trend}\n   ${l.verdict}`)
        .join("\n")
    );
  }

  if (report.good_themes.length > 0) {
    parts.push("");
    parts.push(sectionHeader("✓ WHAT'S GOING WELL"));
    parts.push(
      report.good_themes
        .map((t) => `+ ${t.theme} (${fmtSigned(t.avg_sentiment_score)}, ${t.mention_count} mentions — ${t.location_names.join(", ")})\n  ${t.description}`)
        .join("\n")
    );
  }

  if (report.bad_themes.length > 0) {
    parts.push("");
    parts.push(sectionHeader("✕ WHAT'S NOT WORKING"));
    parts.push(
      report.bad_themes
        .map((t) => `- ${t.theme} (${fmtSigned(t.avg_sentiment_score)}, ${t.mention_count} mentions — ${t.location_names.join(", ")})\n  ${t.description}`)
        .join("\n")
    );
  }

  if (report.recommended_actions.length > 0) {
    parts.push("");
    parts.push(sectionHeader("RECOMMENDED ACTIONS"));
    parts.push(
      report.recommended_actions.map((a, i) => `${i + 1}. ${a.title}\n   ${a.detail}`).join("\n\n")
    );
  }

  const categoryAverages = categoryGroupAverages(report);
  if (categoryAverages.length > 0) {
    parts.push("");
    parts.push(sectionHeader("CATEGORY SNAPSHOT (90-DAY)"));
    parts.push(categoryAverages.join(" · "));
  }

  parts.push("");
  parts.push("—");
  parts.push("Full report with all themes, quotes, and charts is in the Reviews Analytics dashboard.");
  parts.push("The full PDF is attached — remember to attach it manually if you're reading this before doing so.");

  return parts.join("\n").trim();
}

/** Opens a new tab with a Gmail compose window pre-filled with the report. */
export function openGmailDraft(report: WeeklyReport, quotes: ReportQuoteSnapshot[] = []): void {
  const subject = encodeURIComponent(weeklyReportEmailSubject(report));
  const body = encodeURIComponent(weeklyReportEmailBody(report, quotes));
  const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
