"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportHistoryCard from "@/components/dashboard/ReportHistoryCard";
import ReportDetailModal from "@/components/dashboard/ReportDetailModal";
import { MOCK_REPORT_QUOTES } from "@/lib/mock-data";
import type { ReportQuoteSnapshot, WeeklyReport } from "@/types";

interface ReportsPageClientProps {
  initialReports: WeeklyReport[];
  // Demo mode (no real locations yet): generation stays local, no API calls
  demo: boolean;
}

export default function ReportsPageClient({ initialReports, demo }: ReportsPageClientProps) {
  const [reports, setReports] = useState<WeeklyReport[]>(initialReports);
  const [openReport, setOpenReport] = useState<WeeklyReport | null>(null);
  const [openQuotes, setOpenQuotes] = useState<ReportQuoteSnapshot[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDemoReport(report: WeeklyReport) {
    setOpenReport(report);
    setOpenQuotes(MOCK_REPORT_QUOTES["report-1"] ?? []);
  }

  async function openRealReport(report: WeeklyReport) {
    setOpenReport(report);
    setOpenQuotes([]);
    const res = await fetch(`/api/reports/${report.id}`);
    const data = await res.json();
    if (res.ok) setOpenQuotes(data.data.quotes ?? []);
  }

  function generateDemoReport() {
    const base = initialReports[0];
    if (!base) return;
    const report: WeeklyReport = {
      ...base,
      id: `report-${Date.now()}`,
      generated_at: new Date().toISOString(),
    };
    setReports((prev) => [report, ...prev]);
    openDemoReport(report);
  }

  async function generateReport() {
    setError(null);
    if (demo) {
      generateDemoReport();
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate report");
      const report = data.data as WeeklyReport;
      setReports((prev) => [report, ...prev]);
      await openRealReport(report);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  function openReportDetail(report: WeeklyReport) {
    if (demo) openDemoReport(report);
    else openRealReport(report);
  }

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto space-y-7">
      <div className="max-w-2xl flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">Reports</p>
          <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
            The health of your business, in one page.
          </h1>
          <p className="text-sm text-ink-soft mt-2 leading-relaxed">
            Compares the last 7 days against the prior period — what&apos;s going well, what&apos;s not, how every
            location ranks, and what to do about it. On-demand for now; no auto-send yet.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-neg bg-[#fbeeea] rounded-lg px-4 py-3">{error}</p>}

      <div className="flex justify-end">
        <Button
          onClick={generateReport}
          disabled={generating}
          className="bg-forest hover:bg-forest-soft text-paper gap-1.5"
        >
          {generating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Building report…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> Generate weekly report
            </>
          )}
        </Button>
      </div>

      <div>
        <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-3">
          History{reports.length > 0 ? ` · ${reports.length}` : ""}
        </p>
        <div className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-center py-12 text-sm text-ink-faint">
              No reports yet. Generate this week&apos;s report to get started.
            </p>
          ) : (
            reports.map((r) => <ReportHistoryCard key={r.id} report={r} onOpen={() => openReportDetail(r)} />)
          )}
        </div>
      </div>

      {openReport && (
        <ReportDetailModal report={openReport} quotes={openQuotes} onClose={() => setOpenReport(null)} />
      )}
    </div>
  );
}
