"use client";

/**
 * One-page public-reviews preview report: themes, top fixes, risks.
 * Fetches /api/preview/report (cached 24h server-side). Every number shown
 * comes from the public reviews actually fetched — nothing is illustrative.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Download, Loader2, ThumbsUp, Wrench } from "lucide-react";
import type { PreviewReport } from "@/lib/preview-report/build";
import { CATEGORY_LABEL, RISK_LABEL } from "@/lib/preview-report/html";

const fmt = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);

function Bar({ score }: { score: number }) {
  const pct = Math.round(Math.abs(score) * 50);
  return (
    <div className="h-1.5 bg-line-soft rounded-full w-full relative overflow-hidden">
      <div className="absolute top-0 bottom-0 w-px bg-ink-faint left-1/2" />
      <div
        className="absolute top-0 bottom-0 rounded-full"
        style={{
          width: `${pct}%`,
          left: score >= 0 ? "50%" : `${50 - pct}%`,
          background: score >= 0 ? "#17402f" : "#b42318",
        }}
      />
    </div>
  );
}

export default function PreviewReportView({ placeId }: { placeId: string }) {
  const [report, setReport] = useState<PreviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/preview/report?place_id=${encodeURIComponent(placeId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.report) setError(data.error ?? "Something went wrong.");
        else setReport(data.report);
      })
      .catch(() => !cancelled && setError("Network error — please try again."));
    return () => {
      cancelled = true;
    };
  }, [placeId]);

  if (error) {
    return (
      <div className="bg-paper rounded-2xl border border-line p-8 text-center">
        <p className="text-ink font-semibold">We couldn&apos;t build this report</p>
        <p className="text-sm text-ink-soft mt-2">{error}</p>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="bg-paper rounded-2xl border border-line p-10 text-center">
        <Loader2 className="w-6 h-6 text-forest animate-spin mx-auto" />
        <p className="text-sm text-ink-soft mt-3">Reading the public reviews and grouping them into themes… (about 15 seconds)</p>
      </div>
    );
  }

  const r = report;
  return (
    <div className="space-y-6">
      <div className="bg-paper rounded-2xl border border-line p-6">
        <span className="inline-block text-[11px] uppercase tracking-[0.16em] text-forest font-semibold bg-[#eef6f1] rounded-full px-3 py-1">
          Public-reviews preview
        </span>
        <h1 className="font-heading text-[28px] font-semibold text-ink mt-3">{r.name}</h1>
        <p className="text-sm text-ink-soft">{r.address}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-ink">
          <span>
            <b>{r.rating ?? "–"}★</b> on Google · {r.total_reviews.toLocaleString()} reviews
          </span>
          <span>
            Based on <b>{r.reviews_analyzed}</b> of {r.total_reviews.toLocaleString()} reviews
          </span>
        </div>
        <div className="mt-4 flex gap-3 print:hidden">
          <a
            href={`/api/preview/report/pdf?place_id=${encodeURIComponent(r.place_id)}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-forest border border-forest/30 rounded-lg px-3 py-1.5 hover:bg-[#eef6f1]"
          >
            <Download className="w-4 h-4" /> Download PDF
          </a>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-paper rounded-2xl border border-line p-6">
          <h2 className="font-heading text-lg font-semibold text-ink flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#b42318]" /> Top fixes
          </h2>
          {r.top_fixes.length === 0 ? (
            <p className="text-sm text-ink-soft mt-3">No clear complaints in the public sample.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {r.top_fixes.map((f, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold text-ink">
                    {i + 1}. {f.title}{" "}
                    <span className="text-[11px] font-medium text-forest bg-[#eef6f1] rounded-full px-2 py-0.5">
                      {CATEGORY_LABEL[f.category] ?? f.category}
                    </span>
                  </p>
                  <p className="text-ink-soft mt-0.5">{f.detail}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="bg-paper rounded-2xl border border-line p-6">
          <h2 className="font-heading text-lg font-semibold text-ink flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-forest" /> What guests love
          </h2>
          {r.strengths.length === 0 ? (
            <p className="text-sm text-ink-soft mt-3">No clear praise themes in the public sample.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {r.strengths.map((f, i) => (
                <li key={i} className="text-sm">
                  <p className="font-semibold text-ink">{f.title}</p>
                  <p className="text-ink-soft mt-0.5">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-paper rounded-2xl border border-line p-6">
        <h2 className="font-heading text-lg font-semibold text-ink">Themes</h2>
        {r.themes.length === 0 ? (
          <p className="text-sm text-ink-soft mt-3">Not enough review text to group into themes.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {r.themes.map((t) => (
              <div key={t.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{CATEGORY_LABEL[t.category]}</span>
                  <span className="text-ink-soft">
                    {t.mentions} of {r.reviews_analyzed} reviews ·{" "}
                    <b style={{ color: t.avg_sentiment < 0 ? "#b42318" : "#17402f" }}>{fmt(t.avg_sentiment)}</b>
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar score={t.avg_sentiment} />
                </div>
                {t.quotes[0] && (
                  <p className="text-xs text-ink-soft mt-1.5 italic">
                    “{t.quotes[0].text}” — {t.quotes[0].stars}★
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-paper rounded-2xl border border-line p-6">
        <h2 className="font-heading text-lg font-semibold text-ink flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#b45309]" /> Risks
        </h2>
        {r.risks.length === 0 ? (
          <p className="text-sm text-ink-soft mt-3">
            No health, legal, discrimination or safety flags in the public sample.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {r.risks.map((k) => (
              <li key={k.flag}>
                <b className="text-ink">{RISK_LABEL[k.flag]}</b>
                <span className="text-ink-soft">
                  {" "}
                  — {k.count} review{k.count > 1 ? "s" : ""}: “{k.quotes[0]}”
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-forest text-paper rounded-2xl p-6 print:hidden">
        <p className="font-heading text-lg font-semibold">
          This is {r.reviews_analyzed} reviews. You have {r.total_reviews.toLocaleString()}.
        </p>
        <p className="text-sm opacity-90 mt-1">
          Google&apos;s public API only shows a handful of reviews per place, so this is a snapshot, not a trend.
          Reviews Analytics reads every review across every location and ranks what&apos;s costing you stars — $89
          per location per month, with a free pilot.
        </p>
        <a
          href="https://reviewsanalytics.ai/start"
          className="inline-flex items-center gap-2 mt-4 bg-paper text-forest font-semibold text-sm rounded-lg px-4 py-2"
        >
          Start the free pilot <ArrowRight className="w-4 h-4" />
        </a>
      </section>

      <p className="text-[11px] text-ink-faint">
        Generated {new Date(r.generated_at).toLocaleString()} from public Google reviews
        {r.oldest_review_at && r.newest_review_at
          ? ` dated ${r.oldest_review_at.slice(0, 10)} to ${r.newest_review_at.slice(0, 10)}`
          : ""}
        . Categories and sentiment are AI-assigned.
      </p>
    </div>
  );
}
