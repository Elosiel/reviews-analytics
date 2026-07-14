"use client";

import { useState } from "react";
import { X, Download, Loader2, TrendingUp, TrendingDown, Minus, Sparkles, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, fmtScore } from "@/lib/design";
import ScoreScaleNote from "@/components/dashboard/ScoreScaleNote";
import ReportCategoryHeatmap from "@/components/dashboard/ReportCategoryHeatmap";
import type { DangerFlag, WeeklyReport, ReportQuoteSnapshot, ReportTheme } from "@/types";
import { cn } from "@/lib/utils";

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

const TREND_ICON = { improving: TrendingUp, declining: TrendingDown, flat: Minus };
const TREND_COLOR = { improving: "text-pos", declining: "text-neg", flat: "text-ink-faint" };

interface ReportDetailModalProps {
  report: WeeklyReport;
  quotes: ReportQuoteSnapshot[];
  onClose: () => void;
}

function ThemeSection({
  title,
  themes,
  quotes,
  tone,
}: {
  title: string;
  themes: ReportTheme[];
  quotes: ReportQuoteSnapshot[];
  tone: "good" | "bad";
}) {
  if (themes.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2.5">{title}</p>
      <div className="space-y-4">
        {themes.map((t, i) => {
          const themeQuotes = quotes.filter((q) => q.theme_kind === tone && q.category === t.category);
          return (
            <div key={`${t.category}-${i}`} className="pb-4 border-b border-line-soft last:border-0 last:pb-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {CATEGORY_LABELS[t.category]}
                </span>
                <span className={cn("text-xs font-semibold tabular-nums", tone === "good" ? "text-pos" : "text-neg")}>
                  {fmtScore(t.avg_sentiment_score)}
                </span>
                <span className="text-xs text-ink-faint">
                  {t.mention_count} mention{t.mention_count !== 1 ? "s" : ""} · {t.location_names.join(", ")}
                </span>
              </div>
              <p className="font-heading text-sm font-semibold text-ink mb-1">{t.theme}</p>
              <p className="text-sm text-ink-soft leading-relaxed">{t.description}</p>
              {themeQuotes.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {themeQuotes.map((q) => (
                    <blockquote key={q.id} className="border-l-2 border-line pl-3 text-xs text-ink-soft italic">
                      &ldquo;{q.quote_text ?? "Quote no longer available — past the 30-day window"}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportDetailModal({ report, quotes, onClose }: ReportDetailModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownloadPdf() {
    if (downloading) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      // Dynamic import: the rasterizer libs load only when someone
      // actually downloads, never on dashboard page load.
      const { downloadWeeklyReportPdf } = await import("@/lib/reports/download-weekly-report-pdf");
      await downloadWeeklyReportPdf(report, quotes);
    } catch (err) {
      console.error("Weekly report PDF download failed:", err);
      setDownloadError("Couldn't build the PDF — please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-2xl border border-line max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line-soft">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-0.5 font-medium">
              Weekly Report
            </p>
            <h2 className="font-heading text-lg font-semibold text-ink">
              {fmtDate(report.period_start)} – {fmtDate(report.period_end)}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink shrink-0 ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          <ScoreScaleNote />

          {/* Danger flags — loudest element in the report, same as the dashboard */}
          {report.needs_attention.length > 0 && (
            <div className="space-y-2">
              {report.needs_attention.map((item) => {
                const itemQuote = quotes.find(
                  (q) => q.theme_kind === "danger" && q.review_id === item.review_id
                );
                return (
                  <div
                    key={item.review_id}
                    className="rounded-2xl border-2 border-neg/40 bg-[#fbeeea] p-5 flex items-start gap-4"
                  >
                    <div className="w-9 h-9 rounded-full bg-neg flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4.5 h-4.5 text-paper" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading text-base font-semibold text-[#7a1f13]">
                          Needs your attention today
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide bg-neg text-paper rounded-full px-2 py-0.5">
                          {FLAG_LABELS[item.flag]}
                        </span>
                        <span className="text-xs text-ink-faint">
                          {item.location_name} · {item.star_rating}★
                        </span>
                      </div>
                      {itemQuote?.quote_text && (
                        <blockquote className="mt-2 text-sm text-[#66261a] italic border-l-2 border-neg/40 pl-3">
                          &ldquo;{itemQuote.quote_text}&rdquo;
                        </blockquote>
                      )}
                      <p className="mt-2 text-xs text-[#8a5347]">
                        {`A guest reported a possible ${FLAG_LABELS[item.flag].toLowerCase()} issue. Review it with your manager before tonight's service — these are flagged no matter which category they fall under.`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Executive summary */}
          <div>
            <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2">
              Executive Summary
            </p>
            <p className="text-sm text-ink leading-relaxed">{report.executive_summary}</p>
          </div>

          {/* Location ranking */}
          <div>
            <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2.5">
              Location Ranking
            </p>
            <div className="space-y-2">
              {report.location_rankings.map((loc) => {
                const TrendIcon = TREND_ICON[loc.trend];
                return (
                  <div key={loc.location_id} className="rounded-xl bg-cream border border-line-soft p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-line-soft text-ink-soft text-xs font-bold flex items-center justify-center shrink-0">
                          {loc.rank}
                        </span>
                        <span className="font-heading text-sm font-semibold text-ink">{loc.location_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("flex items-center gap-1 text-xs font-semibold", TREND_COLOR[loc.trend])}>
                          <TrendIcon className="w-3 h-3" /> {loc.trend}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-ink-soft">
                          {fmtScore(loc.composite_score)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed mt-2">{loc.verdict}</p>
                    <p className="text-[11px] text-ink-faint mt-1.5">
                      {loc.review_count} review{loc.review_count !== 1 ? "s" : ""} this period
                      {loc.avg_rating !== null ? ` · avg ${loc.avg_rating.toFixed(1)}★` : ""} · {loc.trend_basis}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <ThemeSection title="What's Going Well" themes={report.good_themes} quotes={quotes} tone="good" />
          <ThemeSection title="What's Not Working" themes={report.bad_themes} quotes={quotes} tone="bad" />

          {/* Recommended actions */}
          {report.recommended_actions.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2.5">
                Recommended Actions
              </p>
              <div className="space-y-2.5">
                {report.recommended_actions.map((a, i) => (
                  <div key={i} className="rounded-xl bg-[#f0f4ee] border border-forest/15 p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-forest shrink-0" />
                      <p className="text-sm font-semibold text-forest">{a.title}</p>
                    </div>
                    <p className="text-sm text-[#2c3d2f] leading-relaxed">{a.detail}</p>
                    {(a.category || a.location_name) && (
                      <p className="text-[11px] text-forest/70 mt-1.5">
                        {a.category ? CATEGORY_LABELS[a.category] : "Brand-wide"}
                        {a.location_name ? ` · ${a.location_name}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReportCategoryHeatmap locationRankings={report.location_rankings} matrix={report.category_matrix} />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-line-soft">
          {downloadError && (
            <p className="text-xs text-neg mb-3 text-center">{downloadError}</p>
          )}
          <Button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="w-full bg-forest hover:bg-forest-soft text-paper gap-2"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Preparing PDF…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Download PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
