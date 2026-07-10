/**
 * Weekly report → email draft.
 *
 * Pre-fills a subject + plaintext body into a Gmail compose window so the
 * owner can review and send it themselves — there's no server-side send
 * for reports (that's an intentional v1 non-goal, see the Reports page
 * copy). Gmail's compose deep link can't attach files, so the PDF has to
 * be attached by hand; the UI says so before opening the window.
 */

import type { WeeklyReport } from "@/types";

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

export function weeklyReportEmailSubject(report: WeeklyReport): string {
  return `Weekly report — ${fmtDate(report.period_start)} to ${fmtDate(report.period_end)}`;
}

export function weeklyReportEmailBody(report: WeeklyReport): string {
  const rankingLines = report.location_rankings
    .map((l) => `${l.rank}. ${l.location_name} (${fmtSigned(l.composite_score)}, ${l.trend}) — ${l.verdict}`)
    .join("\n");

  const actionLines = report.recommended_actions
    .map((a, i) => `${i + 1}. ${a.title}\n   ${a.detail}`)
    .join("\n\n");

  return `WEEKLY REPORT — ${fmtDate(report.period_start)} to ${fmtDate(report.period_end)}

${report.executive_summary}

LOCATION RANKING
${rankingLines}

TOP RECOMMENDED ACTIONS
${actionLines}

—
Full report with themes, quotes, and charts is in the Reviews Analytics dashboard.
The full PDF is attached — remember to attach it manually if you're reading this before doing so.`.trim();
}

/** Opens a new tab with a Gmail compose window pre-filled with the report. */
export function openGmailDraft(report: WeeklyReport): void {
  const subject = encodeURIComponent(weeklyReportEmailSubject(report));
  const body = encodeURIComponent(weeklyReportEmailBody(report));
  const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
