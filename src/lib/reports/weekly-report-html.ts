/**
 * Weekly report export — a real print of the app's own design, not a
 * hand-drawn reconstruction. Uses the same popup-window + window.print()
 * mechanic as the Meetings/SOPs exports (src/lib/export-brief.ts), with
 * a stylesheet hand-matched to the on-screen report
 * (ReportDetailModal.tsx / ReportCategoryHeatmap.tsx / ScoreScaleNote):
 * same brand hex values (src/app/globals.css), same Fraunces/Geist
 * fonts, same section order, same card styling, same heatmap coloring
 * (reusing heatStep/HEAT_RAMP from src/lib/design.ts directly).
 *
 * No PDF binary is ever persisted — the browser's own "Save as PDF"
 * print destination produces the file, straight from the report's
 * stored JSON.
 */

import { openPrintWindow } from "@/lib/export-brief";
import { CATEGORIES, CATEGORY_LABELS, HEAT_RAMP, fmtScore, heatStep } from "@/lib/design";
import type {
  DangerFlag,
  MatrixCell,
  ReportLocationRanking,
  ReportQuoteSnapshot,
  ReportTheme,
  SentimentCategory,
  WeeklyReport,
} from "@/types";

const FLAG_LABELS: Record<DangerFlag, string> = {
  health_safety: "Health & safety",
  legal: "Legal",
  discrimination: "Discrimination",
  physical_safety: "Physical safety",
};

function fmtDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Mirrors src/app/globals.css's @theme brand tokens + the hand-picked
// hex values already used in the on-screen cards (bg-[#fbeeea] etc.) —
// same palette, plain hex so nothing relies on Tailwind's runtime.
const REPORT_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Geist:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif; color: #1d1a14; background: #eef1ee; max-width: 680px; margin: 0 auto; padding: 24px; }

.header { background: #17402f; color: #fffdf8; border-radius: 16px; padding: 22px 26px; margin-bottom: 20px; }
.eyebrow { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #c9d8d0; margin: 0 0 6px; }
.header h1 { font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 700; margin: 0; }
.header .generated { font-size: 11px; color: #c9d8d0; margin: 6px 0 0; }

.note { background: #fffdf8; border: 1px solid #f1ecdf; border-radius: 16px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; color: #5f594c; line-height: 1.6; }
.note strong.label { color: #1d1a14; }
.note .pos { color: #0b7d5a; font-weight: 700; }
.note .neg { color: #c73527; font-weight: 700; }

.danger-card { border: 2px solid #e6b3a8; background: #fbeeea; border-radius: 16px; padding: 20px; margin-bottom: 8px; display: flex; gap: 16px; break-inside: avoid; }
.danger-icon { width: 36px; height: 36px; border-radius: 999px; background: #c73527; color: #fffdf8; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
.danger-top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.danger-title { font-family: 'Fraunces', Georgia, serif; font-size: 16px; font-weight: 600; color: #7a1f13; }
.danger-badge { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; background: #c73527; color: #fffdf8; border-radius: 999px; padding: 2px 8px; }
.danger-meta { font-size: 12px; color: #97907f; }
.danger-quote { margin: 8px 0 0; font-size: 14px; font-style: italic; color: #66261a; border-left: 2px solid #e6b3a8; padding-left: 12px; }
.danger-desc { margin: 8px 0 0; font-size: 12px; color: #8a5347; }

.section { margin-bottom: 24px; }
.section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .14em; color: #97907f; margin: 0 0 10px; }
.summary { font-size: 14px; color: #1d1a14; line-height: 1.6; }

.loc-card { background: #eef1ee; border: 1px solid #f1ecdf; border-radius: 12px; padding: 14px; margin-bottom: 8px; break-inside: avoid; }
.loc-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.loc-left { display: flex; align-items: center; gap: 10px; }
.loc-rank { width: 24px; height: 24px; border-radius: 999px; background: #f1ecdf; color: #5f594c; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.loc-name { font-family: 'Fraunces', Georgia, serif; font-size: 14px; font-weight: 600; color: #1d1a14; }
.loc-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.loc-trend { font-size: 12px; font-weight: 600; }
.loc-trend.improving { color: #0b7d5a; }
.loc-trend.declining { color: #c73527; }
.loc-trend.flat { color: #97907f; }
.loc-score { font-size: 12px; font-weight: 600; color: #5f594c; }
.loc-verdict { font-size: 13px; color: #5f594c; line-height: 1.6; margin: 8px 0 0; }
.loc-meta { font-size: 11px; color: #97907f; margin: 6px 0 0; }

.theme-card { border-bottom: 1px solid #f1ecdf; padding-bottom: 16px; margin-bottom: 16px; break-inside: avoid; }
.theme-card:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.theme-top { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
.theme-cat { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #97907f; }
.theme-score { font-size: 12px; font-weight: 600; }
.theme-score.good { color: #0b7d5a; }
.theme-score.bad { color: #c73527; }
.theme-meta { font-size: 12px; color: #97907f; }
.theme-title { font-family: 'Fraunces', Georgia, serif; font-size: 14px; font-weight: 600; color: #1d1a14; margin: 0 0 4px; }
.theme-desc { font-size: 13px; color: #5f594c; line-height: 1.6; }
.theme-quote { border-left: 2px solid #e9e3d2; padding-left: 12px; font-size: 12px; font-style: italic; color: #5f594c; margin: 8px 0 0; }

.action-card { background: #f0f4ee; border: 1px solid #cfdcc9; border-radius: 12px; padding: 14px; margin-bottom: 10px; break-inside: avoid; }
.action-title { font-size: 14px; font-weight: 600; color: #17402f; margin: 0 0 4px; }
.action-detail { font-size: 13px; color: #2c3d2f; line-height: 1.6; }
.action-tag { font-size: 11px; color: #5d796b; margin: 6px 0 0; }

.heatmap-legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 10px; color: #97907f; margin-bottom: 8px; }
.heatmap-legend .swatch { width: 14px; height: 10px; border-radius: 2px; display: inline-block; }
.heatmap-caption { font-size: 11px; color: #97907f; margin: 0 0 10px; }
.heatmap-wrap { background: #eef1ee; border: 1px solid #f1ecdf; border-radius: 12px; padding: 8px; }
.heatmap-wrap table { width: 100%; border-collapse: separate; border-spacing: 2px; }
.heatmap-wrap th { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #97907f; font-weight: 600; padding: 4px; text-align: center; }
.heatmap-wrap th.loc-head { text-align: left; }
.heatmap-wrap td.loc-cell { font-size: 12px; font-weight: 600; color: #1d1a14; padding: 4px; }
.heat-cell { border-radius: 8px; padding: 6px 2px; text-align: center; }
.heat-cell .score { font-size: 12px; font-weight: 700; display: block; }
.heat-cell .mentions { font-size: 9px; opacity: .75; display: block; }
.heat-cell.weakest { outline: 2px solid #c73527; outline-offset: -2px; }
.heat-avg-row td { border-top: 1px solid #f1ecdf; padding-top: 8px; }
.heat-avg-label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #97907f; font-weight: 600; }
.heat-avg { font-size: 12px; font-weight: 700; text-align: center; }

.footer { font-size: 11px; color: #97907f; margin-top: 24px; border-top: 1px solid #f1ecdf; padding-top: 12px; }

@page { margin: 0.5in; }
`;

function scoreScaleNoteHtml(): string {
  return `
    <div class="note">
      <strong class="label">How to read these scores:</strong>
      every number is an AI sentiment rating from <strong class="neg">−1.0</strong>
      (very negative) to <strong class="pos">+1.0</strong> (very positive) — not a
      star rating. It's the average across only the reviews that mentioned that
      specific topic, from the batch of reviews currently synced into this system,
      which may be a smaller sample than the location's full Google review history.
    </div>
  `;
}

function dangerAlertsHtml(report: WeeklyReport, quotes: ReportQuoteSnapshot[]): string {
  if (report.needs_attention.length === 0) return "";
  return report.needs_attention
    .map((item) => {
      const quote = quotes.find((q) => q.theme_kind === "danger" && q.review_id === item.review_id);
      return `
        <div class="danger-card">
          <div class="danger-icon">!</div>
          <div>
            <div class="danger-top">
              <span class="danger-title">Needs your attention today</span>
              <span class="danger-badge">${esc(FLAG_LABELS[item.flag])}</span>
              <span class="danger-meta">${esc(item.location_name)} · ${item.star_rating}★</span>
            </div>
            ${quote?.quote_text ? `<p class="danger-quote">&ldquo;${esc(quote.quote_text)}&rdquo;</p>` : ""}
            <p class="danger-desc">A guest reported a possible ${esc(
              FLAG_LABELS[item.flag].toLowerCase()
            )} issue. Review it with your manager before tonight's service — these are flagged no matter which category they fall under.</p>
          </div>
        </div>
      `;
    })
    .join("");
}

function locationRankingHtml(locations: ReportLocationRanking[]): string {
  if (locations.length === 0) return "";
  const cards = locations
    .map(
      (loc) => `
      <div class="loc-card">
        <div class="loc-top">
          <div class="loc-left">
            <span class="loc-rank">${loc.rank}</span>
            <span class="loc-name">${esc(loc.location_name)}</span>
          </div>
          <div class="loc-right">
            <span class="loc-trend ${loc.trend}">${esc(loc.trend)}</span>
            <span class="loc-score">${fmtScore(loc.composite_score)}</span>
          </div>
        </div>
        <p class="loc-verdict">${esc(loc.verdict)}</p>
        <p class="loc-meta">${loc.review_count} review${loc.review_count !== 1 ? "s" : ""} this period${
        loc.avg_rating !== null ? ` · avg ${loc.avg_rating.toFixed(1)}★` : ""
      } · ${esc(loc.trend_basis)}</p>
      </div>
    `
    )
    .join("");
  return `
    <div class="section">
      <p class="section-label">Location Ranking</p>
      ${cards}
    </div>
  `;
}

function themeSectionHtml(title: string, themes: ReportTheme[], quotes: ReportQuoteSnapshot[], tone: "good" | "bad"): string {
  if (themes.length === 0) return "";
  const cards = themes
    .map((t) => {
      const themeQuotes = quotes.filter((q) => q.theme_kind === tone && q.category === t.category);
      const quoteHtml = themeQuotes
        .map(
          (q) =>
            `<p class="theme-quote">&ldquo;${esc(
              q.quote_text ?? "Quote no longer available — past the 30-day window"
            )}&rdquo;</p>`
        )
        .join("");
      return `
        <div class="theme-card">
          <div class="theme-top">
            <span class="theme-cat">${esc(CATEGORY_LABELS[t.category])}</span>
            <span class="theme-score ${tone}">${fmtScore(t.avg_sentiment_score)}</span>
            <span class="theme-meta">${t.mention_count} mention${t.mention_count !== 1 ? "s" : ""} · ${esc(
        t.location_names.join(", ")
      )}</span>
          </div>
          <p class="theme-title">${esc(t.theme)}</p>
          <p class="theme-desc">${esc(t.description)}</p>
          ${quoteHtml}
        </div>
      `;
    })
    .join("");
  return `
    <div class="section">
      <p class="section-label">${esc(title)}</p>
      ${cards}
    </div>
  `;
}

function recommendedActionsHtml(report: WeeklyReport): string {
  if (report.recommended_actions.length === 0) return "";
  const cards = report.recommended_actions
    .map((a) => {
      const tag =
        a.category || a.location_name
          ? `<p class="action-tag">${a.category ? esc(CATEGORY_LABELS[a.category]) : "Brand-wide"}${
              a.location_name ? ` · ${esc(a.location_name)}` : ""
            }</p>`
          : "";
      return `
        <div class="action-card">
          <p class="action-title">${esc(a.title)}</p>
          <p class="action-detail">${esc(a.detail)}</p>
          ${tag}
        </div>
      `;
    })
    .join("");
  return `
    <div class="section">
      <p class="section-label">Recommended Actions</p>
      ${cards}
    </div>
  `;
}

// Same weakest-per-category / group-average logic as
// ReportCategoryHeatmap.tsx, mirrored here since this module can't
// import a React component.
function categoryMatrixHtml(
  locations: ReportLocationRanking[],
  matrix: Record<string, Record<SentimentCategory, MatrixCell>>
): string {
  if (locations.length === 0 || Object.keys(matrix).length === 0) return "";

  const cellFor = (locationId: string, cat: SentimentCategory): MatrixCell =>
    matrix[locationId]?.[cat] ?? { score: 0, delta: 0, mentions: 0 };

  const weakestPerCategory: Record<SentimentCategory, string> = {} as Record<SentimentCategory, string>;
  for (const cat of CATEGORIES) {
    let worst = locations[0]?.location_id;
    for (const loc of locations) {
      if (cellFor(loc.location_id, cat).score < cellFor(worst, cat).score) worst = loc.location_id;
    }
    weakestPerCategory[cat] = worst;
  }
  const groupAvg = (cat: SentimentCategory) =>
    locations.length === 0
      ? 0
      : locations.reduce((s, l) => s + cellFor(l.location_id, cat).score, 0) / locations.length;

  const headerCells = CATEGORIES.map((cat) => `<th>${esc(CATEGORY_LABELS[cat])}</th>`).join("");
  const rows = locations
    .map((loc) => {
      const cells = CATEGORIES.map((cat) => {
        const cell = cellFor(loc.location_id, cat);
        const step = heatStep(cell.score);
        const isWeakest = weakestPerCategory[cat] === loc.location_id && cell.score < 0;
        return `
          <td>
            <div class="heat-cell${isWeakest ? " weakest" : ""}" style="background:${step.bg};color:${step.ink}">
              <span class="score">${fmtScore(cell.score)}</span>
              <span class="mentions">${cell.mentions} mention${cell.mentions !== 1 ? "s" : ""}</span>
            </div>
          </td>
        `;
      }).join("");
      return `<tr><td class="loc-cell">${esc(loc.location_name)}</td>${cells}</tr>`;
    })
    .join("");
  const avgCells = CATEGORIES.map((cat) => {
    const avg = groupAvg(cat);
    const color = avg >= 0.2 ? "#0b7d5a" : avg <= -0.2 ? "#c73527" : "#5f594c";
    return `<td class="heat-avg" style="color:${color}">${fmtScore(avg)}</td>`;
  }).join("");
  const legendSwatches = HEAT_RAMP.map((c) => `<span class="swatch" style="background:${c}"></span>`).join("");

  return `
    <div class="section">
      <div class="heatmap-legend">
        <span>Unhappy</span>
        ${legendSwatches}
        <span>Delighted</span>
      </div>
      <p class="section-label">Every Location, Every Category</p>
      <p class="heatmap-caption">90-day snapshot as of this report, from the same rollups the Overview dashboard uses. Outlined cells are the weakest location for that category.</p>
      <div class="heatmap-wrap">
        <table>
          <thead><tr><th class="loc-head">Location</th>${headerCells}</tr></thead>
          <tbody>
            ${rows}
            <tr class="heat-avg-row">
              <td class="heat-avg-label">Group average</td>
              ${avgCells}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/** Exported for testing — the pure HTML string builder behind printWeeklyReport. */
export function buildWeeklyReportHtml(report: WeeklyReport, quotes: ReportQuoteSnapshot[]): string {
  return `
    <div class="header">
      <p class="eyebrow">Reviews Analytics · Weekly Report</p>
      <h1>${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}</h1>
      <p class="generated">Generated ${new Date(report.generated_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}</p>
    </div>

    ${scoreScaleNoteHtml()}
    ${dangerAlertsHtml(report, quotes)}

    <div class="section">
      <p class="section-label">Executive Summary</p>
      <p class="summary">${esc(report.executive_summary)}</p>
    </div>

    ${locationRankingHtml(report.location_rankings)}
    ${themeSectionHtml("What's Going Well", report.good_themes, quotes, "good")}
    ${themeSectionHtml("What's Not Working", report.bad_themes, quotes, "bad")}
    ${recommendedActionsHtml(report)}
    ${categoryMatrixHtml(report.location_rankings, report.category_matrix)}
  `;
}

/** Opens a print window styled to match the on-screen report exactly — the user picks "Save as PDF" as the print destination. */
export function printWeeklyReport(report: WeeklyReport, quotes: ReportQuoteSnapshot[] = []): void {
  const title = `Weekly Report — ${fmtDate(report.period_start)} to ${fmtDate(report.period_end)}`;
  openPrintWindow(title, buildWeeklyReportHtml(report, quotes), REPORT_STYLES);
}

/**
 * Opens the same styled report tab as printWeeklyReport, but as a pure
 * visual reference — no print dialog triggered. Used alongside the
 * Gmail draft so "Email draft" surfaces the real dashboard UX, which
 * Gmail's plain-text-only compose body can't carry on its own.
 */
export function previewWeeklyReport(report: WeeklyReport, quotes: ReportQuoteSnapshot[] = []): void {
  const title = `Weekly Report — ${fmtDate(report.period_start)} to ${fmtDate(report.period_end)}`;
  openPrintWindow(title, buildWeeklyReportHtml(report, quotes), REPORT_STYLES, false);
}
