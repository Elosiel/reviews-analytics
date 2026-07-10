/**
 * Weekly report PDF export.
 *
 * Regenerated client-side, on demand, straight from the report's stored
 * JSON — no PDF binary is ever persisted server-side (per spec: keep the
 * source of truth as data, not a rendered file).
 */

import { jsPDF } from "jspdf";
import type { WeeklyReport } from "@/types";
import { CATEGORY_LABELS } from "@/lib/design";

const MARGIN = 48;
const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = "#1d1a14";
const INK_SOFT = "#5f594c";
const POS = "#0b7d5a";
const NEG = "#c73527";

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

class PdfCursor {
  doc: jsPDF;
  y: number;

  constructor(doc: jsPDF) {
    this.doc = doc;
    this.y = MARGIN;
  }

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  heading(text: string) {
    this.ensureSpace(24);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.setTextColor(INK);
    this.doc.text(text, MARGIN, this.y);
    this.y += 8;
    this.doc.setDrawColor(INK_SOFT);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 16;
  }

  paragraph(text: string, opts: { size?: number; color?: string; bold?: boolean; gap?: number } = {}) {
    const { size = 10, color = INK_SOFT, bold = false, gap = 14 } = opts;
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(color);
    const lines: string[] = this.doc.splitTextToSize(text, CONTENT_WIDTH);
    this.ensureSpace(lines.length * (size * 1.35));
    for (const line of lines) {
      this.doc.text(line, MARGIN, this.y);
      this.y += size * 1.35;
    }
    this.y += gap;
  }

  spacer(height: number) {
    this.y += height;
  }
}

export function downloadWeeklyReportPdf(report: WeeklyReport): void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const c = new PdfCursor(doc);

  // ── Header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(INK);
  doc.text("Weekly Report", MARGIN, c.y + 8);
  c.y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(INK_SOFT);
  doc.text(`${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}`, MARGIN, c.y);
  c.y += 14;
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date(report.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` +
      (report.ai_generated ? "" : " · Built without AI narration (no Anthropic API key configured)"),
    MARGIN,
    c.y
  );
  c.y += 24;

  // ── Executive summary ──
  c.heading("Executive Summary");
  c.paragraph(report.executive_summary, { size: 10.5, color: INK, gap: 20 });

  // ── Location ranking ──
  c.heading("Location Ranking");
  for (const loc of report.location_rankings) {
    c.ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(INK);
    doc.text(`#${loc.rank}  ${loc.location_name}`, MARGIN, c.y);

    const scoreColor = loc.composite_score > 0 ? POS : loc.composite_score < 0 ? NEG : INK_SOFT;
    doc.setTextColor(scoreColor);
    const scoreText = `${fmtSigned(loc.composite_score)}  ·  ${loc.trend}`;
    doc.text(scoreText, PAGE_WIDTH - MARGIN - doc.getTextWidth(scoreText), c.y);
    c.y += 14;
    c.paragraph(loc.verdict, { size: 9.5, gap: 4 });
    c.paragraph(
      `${loc.review_count} review${loc.review_count !== 1 ? "s" : ""} this period${loc.avg_rating !== null ? ` · avg ${loc.avg_rating.toFixed(1)}★` : ""} · ${loc.trend_basis}`,
      { size: 8.5, color: "#97907f", gap: 12 }
    );
  }
  c.spacer(8);

  // ── Good themes ──
  if (report.good_themes.length > 0) {
    c.heading("What's Going Well");
    for (const t of report.good_themes) {
      c.paragraph(`${CATEGORY_LABELS[t.category]} — ${t.theme}`, { size: 10.5, color: POS, bold: true, gap: 4 });
      c.paragraph(t.description, { size: 9.5, gap: 4 });
      c.paragraph(
        `${t.mention_count} mention${t.mention_count !== 1 ? "s" : ""} · ${fmtSigned(t.avg_sentiment_score)} avg sentiment · ${t.location_names.join(", ")}`,
        { size: 8.5, color: "#97907f", gap: 12 }
      );
    }
  }

  // ── Bad themes ──
  if (report.bad_themes.length > 0) {
    c.heading("What Needs Attention");
    for (const t of report.bad_themes) {
      c.paragraph(`${CATEGORY_LABELS[t.category]} — ${t.theme}`, { size: 10.5, color: NEG, bold: true, gap: 4 });
      c.paragraph(t.description, { size: 9.5, gap: 4 });
      c.paragraph(
        `${t.mention_count} mention${t.mention_count !== 1 ? "s" : ""} · ${fmtSigned(t.avg_sentiment_score)} avg sentiment · ${t.location_names.join(", ")}`,
        { size: 8.5, color: "#97907f", gap: 12 }
      );
    }
  }

  // ── Recommended actions ──
  if (report.recommended_actions.length > 0) {
    c.heading("Recommended Actions");
    report.recommended_actions.forEach((a, i) => {
      c.paragraph(`${i + 1}. ${a.title}`, { size: 10.5, color: INK, bold: true, gap: 4 });
      c.paragraph(a.detail, { size: 9.5, gap: 12 });
    });
  }

  doc.save(`weekly-report-${report.period_start}-to-${report.period_end}.pdf`);
}
