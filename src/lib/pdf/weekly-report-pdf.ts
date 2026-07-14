/**
 * Weekly report PDF export.
 *
 * Regenerated client-side, on demand, straight from the report's stored
 * JSON — no PDF binary is ever persisted server-side (per spec: keep the
 * source of truth as data, not a rendered file).
 *
 * Styled to match the app's own report view (ReportDetailModal /
 * NeedsAttentionBanner): same palette, same section order, same
 * green/red contrast for good vs bad. Written as small section-renderer
 * functions on a shared PdfCursor so future report fields (a new theme
 * type, a new chart) slot in without restructuring the whole file — this
 * is meant to be the framework every future report export builds on.
 */

import { jsPDF } from "jspdf";
import type { DangerFlag, ReportQuoteSnapshot, ReportTheme, SentimentCategory, WeeklyReport } from "@/types";
import { CATEGORIES, CATEGORY_LABELS, heatStep } from "@/lib/design";

const MARGIN = 44;
const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Mirrors src/lib/design.ts + the app's Tailwind palette (forest/cream/ink)
const FOREST = "#17402f";
const FOREST_SOFT = "#2d5a3d";
const SAGE_BG = "#f0f4ee";
const SAGE_BORDER = "#cfdcc9";
const INK = "#1d1a14";
const INK_SOFT = "#5f594c";
const INK_FAINT = "#97907f";
const CREAM = "#fffdf8";
const LINE_SOFT = "#f1ecdf";
const POS = "#0b7d5a";
const POS_BG = "#eef6f1";
const POS_BORDER = "#cfe4d6";
const NEG = "#c73527";
const NEG_BG = "#fbeeea";
const NEG_BORDER = "#e6b3a8";
const NEG_DARK = "#7a1f13";
const NEG_TEXT = "#66261a";
const NEG_SUBTEXT = "#8a5347";

const FLAG_LABELS: Record<DangerFlag, string> = {
  health_safety: "Health & safety",
  legal: "Legal",
  discrimination: "Discrimination",
  physical_safety: "Physical safety",
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

const TREND_ARROW: Record<WeeklyReport["location_rankings"][number]["trend"], string> = {
  improving: "▲",
  declining: "▼",
  flat: "–",
};

/**
 * Owns page flow (cursor position, page breaks, running page count) plus
 * a small vocabulary of draw primitives (heading, paragraph, card,
 * divider, bar) so section renderers stay declarative — they say what to
 * draw, the cursor worries about where.
 */
class PdfCursor {
  doc: jsPDF;
  y: number;
  page: number;

  constructor(doc: jsPDF) {
    this.doc = doc;
    this.y = MARGIN;
    this.page = 1;
  }

  newPage() {
    this.doc.addPage();
    this.page += 1;
    this.y = MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN - 20) this.newPage();
  }

  sectionHeading(text: string) {
    this.ensureSpace(26);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12.5);
    this.doc.setTextColor(INK);
    this.doc.text(text.toUpperCase(), MARGIN, this.y);
    this.y += 7;
    this.doc.setDrawColor(LINE_SOFT);
    this.doc.setLineWidth(1);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 16;
  }

  paragraph(
    text: string,
    opts: { size?: number; color?: string; bold?: boolean; italic?: boolean; gap?: number; maxWidth?: number; x?: number } = {}
  ) {
    const { size = 10, color = INK_SOFT, bold = false, italic = false, gap = 14, maxWidth = CONTENT_WIDTH, x = MARGIN } = opts;
    this.doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
    const lines: string[] = this.doc.splitTextToSize(text, maxWidth);
    this.ensureSpace(lines.length * (size * 1.35) + gap);
    for (const line of lines) {
      this.doc.text(line, x, this.y);
      this.y += size * 1.35;
    }
    this.y += gap;
  }

  spacer(height: number) {
    this.y += height;
  }
}

// ── Section renderers ────────────────────────────────────────────────

function renderHeader(c: PdfCursor, report: WeeklyReport) {
  const bandHeight = 92;
  c.doc.setFillColor(FOREST);
  c.doc.rect(0, 0, PAGE_WIDTH, bandHeight, "F");

  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(11);
  c.doc.setTextColor("#c9d8d0");
  c.doc.text("REVIEWS ANALYTICS · WEEKLY REPORT", MARGIN, 34);

  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(22);
  c.doc.setTextColor(CREAM);
  c.doc.text(`${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}`, MARGIN, 60);

  c.doc.setFont("helvetica", "normal");
  c.doc.setFontSize(9.5);
  c.doc.setTextColor("#c9d8d0");
  const generatedLine =
    `Generated ${new Date(report.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` +
    (report.ai_generated ? "" : " · Built without AI narration — no AI provider configured when this ran");
  c.doc.text(generatedLine, MARGIN, 78);

  c.y = bandHeight + 24;
}

function renderScoreScaleNote(c: PdfCursor) {
  const body =
    "Every number is an AI sentiment rating from -1.0 (very negative) to +1.0 (very positive) — not a star rating. It's the average across only the reviews that mentioned that specific topic, from the batch of reviews currently synced into this system, which may be a smaller sample than the location's full Google review history.";
  const lines: string[] = c.doc.splitTextToSize(body, CONTENT_WIDTH - 20);
  const boxHeight = 16 + lines.length * 10.5 + 10;
  c.ensureSpace(boxHeight + 10);

  const top = c.y;
  c.doc.setFillColor(CREAM);
  c.doc.setDrawColor(LINE_SOFT);
  c.doc.setLineWidth(1);
  c.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, boxHeight, 6, 6, "FD");

  let ty = top + 16;
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(8.5);
  c.doc.setTextColor(INK);
  c.doc.text("How to read these scores", MARGIN + 10, ty);
  ty += 12;

  c.doc.setFont("helvetica", "normal");
  c.doc.setFontSize(8);
  c.doc.setTextColor(INK_SOFT);
  for (const line of lines) {
    c.doc.text(line, MARGIN + 10, ty);
    ty += 10.5;
  }

  c.y = top + boxHeight + 10;
}

function renderCategoryMatrix(c: PdfCursor, report: WeeklyReport) {
  const locations = report.location_rankings;
  if (locations.length === 0 || Object.keys(report.category_matrix).length === 0) return;
  c.sectionHeading("Every Location, Every Category");
  c.paragraph(
    "90-day snapshot as of this report, from the same rollups the Overview dashboard uses. A red-outlined cell is the weakest location for that category.",
    { size: 8.5, color: INK_FAINT, gap: 10 }
  );

  const nameColWidth = 96;
  const catColWidth = (CONTENT_WIDTH - nameColWidth) / CATEGORIES.length;
  const cellHeight = 30;
  const headerHeight = 14;
  const cellFor = (locationId: string, cat: SentimentCategory) =>
    report.category_matrix[locationId]?.[cat] ?? { score: 0, delta: 0, mentions: 0 };

  const weakest: Record<SentimentCategory, string> = {} as Record<SentimentCategory, string>;
  for (const cat of CATEGORIES) {
    let worst = locations[0]?.location_id;
    for (const loc of locations) {
      if (cellFor(loc.location_id, cat).score < cellFor(worst, cat).score) worst = loc.location_id;
    }
    weakest[cat] = worst;
  }

  c.ensureSpace(headerHeight + cellHeight * (locations.length + 1) + 24);

  const headerTop = c.y;
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(7);
  c.doc.setTextColor(INK_FAINT);
  CATEGORIES.forEach((cat, i) => {
    const x = MARGIN + nameColWidth + i * catColWidth;
    const label = CATEGORY_LABELS[cat].toUpperCase();
    const w = c.doc.getTextWidth(label);
    c.doc.text(label, x + catColWidth / 2 - w / 2, headerTop + 8);
  });
  c.y = headerTop + headerHeight;

  for (const loc of locations) {
    const rowTop = c.y;
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(8.5);
    c.doc.setTextColor(INK);
    const nameLines: string[] = c.doc.splitTextToSize(loc.location_name, nameColWidth - 6);
    let nty = rowTop + 12;
    for (const line of nameLines.slice(0, 2)) {
      c.doc.text(line, MARGIN, nty);
      nty += 10;
    }

    CATEGORIES.forEach((cat, i) => {
      const cell = cellFor(loc.location_id, cat);
      const x = MARGIN + nameColWidth + i * catColWidth;
      const step = heatStep(cell.score);
      c.doc.setFillColor(step.bg);
      c.doc.roundedRect(x + 2, rowTop, catColWidth - 4, cellHeight - 4, 4, 4, "F");
      if (weakest[cat] === loc.location_id && cell.score < 0) {
        c.doc.setDrawColor(NEG);
        c.doc.setLineWidth(1.4);
        c.doc.roundedRect(x + 2, rowTop, catColWidth - 4, cellHeight - 4, 4, 4, "S");
      }
      c.doc.setFont("helvetica", "bold");
      c.doc.setFontSize(8);
      c.doc.setTextColor(step.ink);
      const scoreStr = fmtSigned(cell.score);
      const scoreW = c.doc.getTextWidth(scoreStr);
      c.doc.text(scoreStr, x + catColWidth / 2 - scoreW / 2, rowTop + 15);
      c.doc.setFont("helvetica", "normal");
      c.doc.setFontSize(6.5);
      const mStr = `${cell.mentions} mention${cell.mentions !== 1 ? "s" : ""}`;
      const mW = c.doc.getTextWidth(mStr);
      c.doc.text(mStr, x + catColWidth / 2 - mW / 2, rowTop + 24);
    });

    c.y = rowTop + cellHeight;
  }

  // Group average row
  const avgTop = c.y + 6;
  c.doc.setDrawColor(LINE_SOFT);
  c.doc.setLineWidth(1);
  c.doc.line(MARGIN, avgTop - 4, PAGE_WIDTH - MARGIN, avgTop - 4);
  c.doc.setFont("helvetica", "bold");
  c.doc.setFontSize(7.5);
  c.doc.setTextColor(INK_FAINT);
  c.doc.text("GROUP AVERAGE", MARGIN, avgTop + 8);
  CATEGORIES.forEach((cat, i) => {
    const avg =
      locations.length === 0
        ? 0
        : locations.reduce((s, l) => s + cellFor(l.location_id, cat).score, 0) / locations.length;
    const x = MARGIN + nameColWidth + i * catColWidth;
    const color = avg >= 0.2 ? POS : avg <= -0.2 ? NEG : INK_SOFT;
    c.doc.setTextColor(color);
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(8);
    const s = fmtSigned(avg);
    const w = c.doc.getTextWidth(s);
    c.doc.text(s, x + catColWidth / 2 - w / 2, avgTop + 8);
  });
  c.y = avgTop + 18;
  c.spacer(6);
}

function renderDangerAlerts(c: PdfCursor, report: WeeklyReport, quotes: ReportQuoteSnapshot[]) {
  if (report.needs_attention.length === 0) return;
  c.sectionHeading("Needs Your Attention");

  for (const item of report.needs_attention) {
    const quote = quotes.find((q) => q.theme_kind === "danger" && q.review_id === item.review_id);
    const quoteText = quote?.quote_text ?? null;
    const bodyLines: string[] = c.doc.splitTextToSize(
      quoteText ? `"${quoteText}"` : "",
      CONTENT_WIDTH - 24
    );
    const descLines: string[] = c.doc.splitTextToSize(
      `A guest reported a possible ${FLAG_LABELS[item.flag].toLowerCase()} issue. Review it with your manager before tonight's service — these are flagged no matter which category they fall under.`,
      CONTENT_WIDTH - 24
    );
    const cardHeight = 34 + (quoteText ? bodyLines.length * 12 + 6 : 0) + descLines.length * 11 + 12;
    c.ensureSpace(cardHeight + 10);

    const top = c.y;
    c.doc.setFillColor(NEG_BG);
    c.doc.setDrawColor(NEG_BORDER);
    c.doc.setLineWidth(1.2);
    c.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, cardHeight, 8, 8, "FD");

    // Icon circle
    c.doc.setFillColor(NEG);
    c.doc.circle(MARGIN + 18, top + 18, 9, "F");
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(11);
    c.doc.setTextColor(CREAM);
    c.doc.text("!", MARGIN + 15.5, top + 21.5);

    const textX = MARGIN + 36;
    let ty = top + 16;
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(10.5);
    c.doc.setTextColor(NEG_DARK);
    c.doc.text("Needs your attention today", textX, ty);

    const titleWidth = c.doc.getTextWidth("Needs your attention today");
    c.doc.setFillColor(NEG);
    const badgeText = FLAG_LABELS[item.flag].toUpperCase();
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(7.5);
    const badgeW = c.doc.getTextWidth(badgeText) + 12;
    c.doc.roundedRect(textX + titleWidth + 10, ty - 8.5, badgeW, 12, 6, 6, "F");
    c.doc.setTextColor(CREAM);
    c.doc.text(badgeText, textX + titleWidth + 16, ty - 0.5);

    ty += 13;
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(8.5);
    c.doc.setTextColor(INK_FAINT);
    c.doc.text(`${item.location_name} · ${item.star_rating}★`, textX, ty);
    ty += 12;

    if (quoteText) {
      c.doc.setDrawColor(NEG_BORDER);
      c.doc.setLineWidth(1.5);
      c.doc.line(textX, ty - 8, textX, ty - 8 + bodyLines.length * 12);
      c.doc.setFont("helvetica", "italic");
      c.doc.setFontSize(9.5);
      c.doc.setTextColor(NEG_TEXT);
      for (const line of bodyLines) {
        c.doc.text(line, textX + 8, ty);
        ty += 12;
      }
      ty += 4;
    }

    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(8);
    c.doc.setTextColor(NEG_SUBTEXT);
    for (const line of descLines) {
      c.doc.text(line, textX, ty);
      ty += 11;
    }

    c.y = top + cardHeight + 10;
  }
  c.spacer(6);
}

function renderExecutiveSummary(c: PdfCursor, report: WeeklyReport) {
  c.sectionHeading("Executive Summary");
  c.paragraph(report.executive_summary, { size: 10.5, color: INK, gap: 22 });
}

/** Diverging bar anchored at the center — green fill right for positive, red fill left for negative, same visual language as the app's ScoreBar. */
function drawScoreBar(c: PdfCursor, x: number, y: number, width: number, score: number) {
  const height = 6;
  const mid = x + width / 2;
  c.doc.setFillColor(LINE_SOFT);
  c.doc.roundedRect(x, y, width, height, 3, 3, "F");
  c.doc.setDrawColor(INK_FAINT);
  c.doc.setLineWidth(0.5);
  c.doc.line(mid, y - 1, mid, y + height + 1);

  const pct = Math.min(0.5, Math.abs(score) * 0.5);
  const barWidth = pct * width;
  c.doc.setFillColor(score < 0 ? NEG : POS);
  if (score < 0) {
    c.doc.roundedRect(mid - barWidth, y, barWidth, height, 3, 3, "F");
  } else if (score > 0) {
    c.doc.roundedRect(mid, y, barWidth, height, 3, 3, "F");
  }
}

function renderLocationRanking(c: PdfCursor, report: WeeklyReport) {
  if (report.location_rankings.length === 0) return;
  c.sectionHeading("Location Ranking");

  for (const loc of report.location_rankings) {
    const verdictLines: string[] = c.doc.splitTextToSize(loc.verdict, CONTENT_WIDTH - 34);
    const cardHeight = 20 + 14 + verdictLines.length * 12 + 14 + 10;
    c.ensureSpace(cardHeight + 8);

    const top = c.y;
    c.doc.setFillColor(CREAM);
    c.doc.setDrawColor(LINE_SOFT);
    c.doc.setLineWidth(1);
    c.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, cardHeight, 8, 8, "FD");

    // Rank circle
    c.doc.setFillColor(LINE_SOFT);
    c.doc.circle(MARGIN + 16, top + 17, 9, "F");
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(9);
    c.doc.setTextColor(INK_SOFT);
    const rankStr = String(loc.rank);
    c.doc.text(rankStr, MARGIN + 16 - c.doc.getTextWidth(rankStr) / 2, top + 20);

    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(11);
    c.doc.setTextColor(INK);
    c.doc.text(loc.location_name, MARGIN + 32, top + 20);

    // Trend + score, right-aligned
    const trendColor = loc.trend === "improving" ? POS : loc.trend === "declining" ? NEG : INK_FAINT;
    const scoreStr = fmtSigned(loc.composite_score);
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(10.5);
    c.doc.setTextColor(INK_SOFT);
    const scoreW = c.doc.getTextWidth(scoreStr);
    c.doc.text(scoreStr, PAGE_WIDTH - MARGIN - scoreW, top + 20);

    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(8.5);
    c.doc.setTextColor(trendColor);
    const trendStr = `${TREND_ARROW[loc.trend]} ${loc.trend}`;
    const trendW = c.doc.getTextWidth(trendStr);
    c.doc.text(trendStr, PAGE_WIDTH - MARGIN - scoreW - trendW - 10, top + 20);

    // Bar chart
    drawScoreBar(c, MARGIN + 32, top + 28, CONTENT_WIDTH - 32 - 16, loc.composite_score);

    let ty = top + 46;
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9);
    c.doc.setTextColor(INK_SOFT);
    for (const line of verdictLines) {
      c.doc.text(line, MARGIN + 32, ty);
      ty += 12;
    }
    ty += 2;
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(7.5);
    c.doc.setTextColor(INK_FAINT);
    c.doc.text(
      `${loc.review_count} review${loc.review_count !== 1 ? "s" : ""} this period${loc.avg_rating !== null ? ` · avg ${loc.avg_rating.toFixed(1)}★` : ""} · ${loc.trend_basis}`,
      MARGIN + 32,
      ty
    );

    c.y = top + cardHeight + 8;
  }
  c.spacer(6);
}

function renderThemeSection(
  c: PdfCursor,
  title: string,
  themes: ReportTheme[],
  quotes: ReportQuoteSnapshot[],
  tone: "good" | "bad"
) {
  if (themes.length === 0) return;
  c.sectionHeading(title);

  const accent = tone === "good" ? POS : NEG;
  const bg = tone === "good" ? POS_BG : NEG_BG;
  const border = tone === "good" ? POS_BORDER : NEG_BORDER;

  for (const t of themes) {
    const quote = quotes.find((q) => q.theme_kind === tone && q.category === t.category);
    const descLines: string[] = c.doc.splitTextToSize(t.description, CONTENT_WIDTH - 18);
    const quoteLines: string[] = quote?.quote_text
      ? c.doc.splitTextToSize(`"${quote.quote_text}"`, CONTENT_WIDTH - 18)
      : [];
    const cardHeight = 14 + 13 + descLines.length * 12 + (quoteLines.length ? quoteLines.length * 11 + 6 : 0) + 14;
    c.ensureSpace(cardHeight + 8);

    const top = c.y;
    c.doc.setFillColor(bg);
    c.doc.setDrawColor(border);
    c.doc.setLineWidth(1);
    c.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, cardHeight, 6, 6, "FD");
    // Left accent bar
    c.doc.setFillColor(accent);
    c.doc.roundedRect(MARGIN, top, 4, cardHeight, 2, 2, "F");

    const textX = MARGIN + 16;
    let ty = top + 17;
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(8.5);
    c.doc.setTextColor(INK_FAINT);
    c.doc.text(CATEGORY_LABELS[t.category].toUpperCase(), textX, ty);

    const scoreStr = `${fmtSigned(t.avg_sentiment_score)}  ·  ${t.mention_count} mention${t.mention_count !== 1 ? "s" : ""}  ·  ${t.location_names.join(", ")}`;
    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(8);
    c.doc.setTextColor(accent);
    c.doc.text(scoreStr, PAGE_WIDTH - MARGIN - 16 - c.doc.getTextWidth(scoreStr), ty);

    ty += 13;
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(10.5);
    c.doc.setTextColor(INK);
    c.doc.text(t.theme, textX, ty);
    ty += 12;

    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9);
    c.doc.setTextColor(INK_SOFT);
    for (const line of descLines) {
      c.doc.text(line, textX, ty);
      ty += 12;
    }

    if (quoteLines.length) {
      ty += 3;
      c.doc.setFont("helvetica", "italic");
      c.doc.setFontSize(8.5);
      c.doc.setTextColor(INK_SOFT);
      for (const line of quoteLines) {
        c.doc.text(line, textX, ty);
        ty += 11;
      }
    }

    c.y = top + cardHeight + 8;
  }
  c.spacer(6);
}

function renderRecommendedActions(c: PdfCursor, report: WeeklyReport) {
  if (report.recommended_actions.length === 0) return;
  c.sectionHeading("Recommended Actions");

  report.recommended_actions.forEach((a, i) => {
    const detailLines: string[] = c.doc.splitTextToSize(a.detail, CONTENT_WIDTH - 18);
    const tagLine = a.category || a.location_name ? `${a.category ? CATEGORY_LABELS[a.category] : "Brand-wide"}${a.location_name ? ` · ${a.location_name}` : ""}` : null;
    const cardHeight = 16 + detailLines.length * 12 + (tagLine ? 12 : 0) + 12;
    c.ensureSpace(cardHeight + 8);

    const top = c.y;
    c.doc.setFillColor(SAGE_BG);
    c.doc.setDrawColor(SAGE_BORDER);
    c.doc.setLineWidth(1);
    c.doc.roundedRect(MARGIN, top, CONTENT_WIDTH, cardHeight, 6, 6, "FD");

    const textX = MARGIN + 14;
    let ty = top + 17;
    c.doc.setFont("helvetica", "bold");
    c.doc.setFontSize(10);
    c.doc.setTextColor(FOREST);
    c.doc.text(`${i + 1}. ${a.title}`, textX, ty);
    ty += 13;

    c.doc.setFont("helvetica", "normal");
    c.doc.setFontSize(9);
    c.doc.setTextColor(FOREST_SOFT);
    for (const line of detailLines) {
      c.doc.text(line, textX, ty);
      ty += 12;
    }

    if (tagLine) {
      c.doc.setFont("helvetica", "normal");
      c.doc.setFontSize(7.5);
      c.doc.setTextColor(FOREST);
      c.doc.text(tagLine, textX, ty);
    }

    c.y = top + cardHeight + 8;
  });
}

function renderFooters(doc: jsPDF, totalPages: number) {
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(INK_FAINT);
    doc.text("Reviews Analytics · Intelligence powered by your guest reviews.", MARGIN, PAGE_HEIGHT - 24);
    const pageStr = `${p} / ${totalPages}`;
    doc.text(pageStr, PAGE_WIDTH - MARGIN - doc.getTextWidth(pageStr), PAGE_HEIGHT - 24);
  }
}

export function downloadWeeklyReportPdf(report: WeeklyReport, quotes: ReportQuoteSnapshot[] = []): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const c = new PdfCursor(doc);

  renderHeader(c, report);
  renderScoreScaleNote(c);
  renderDangerAlerts(c, report, quotes);
  renderExecutiveSummary(c, report);
  renderLocationRanking(c, report);
  renderCategoryMatrix(c, report);
  renderThemeSection(c, "What's Going Well", report.good_themes, quotes, "good");
  renderThemeSection(c, "What's Not Working", report.bad_themes, quotes, "bad");
  renderRecommendedActions(c, report);

  renderFooters(doc, c.page);

  doc.save(`weekly-report-${report.period_start}-to-${report.period_end}.pdf`);
}
