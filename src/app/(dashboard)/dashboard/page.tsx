"use client";

import { useRef, useState } from "react";
import RankedIssueCard from "@/components/dashboard/RankedIssueCard";
import ShiftMeetingCard from "@/components/dashboard/ShiftMeetingCard";
import NeedsAttentionBanner from "@/components/dashboard/NeedsAttentionBanner";
import ProofOfImpactCard from "@/components/dashboard/ProofOfImpactCard";
import MondayBriefCard from "@/components/dashboard/MondayBriefCard";
import WeakestLinkSpotlight from "@/components/dashboard/WeakestLinkSpotlight";
import CrossLocationHeatmap from "@/components/dashboard/CrossLocationHeatmap";
import GroupTrendChart from "@/components/charts/GroupTrendChart";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import type { RankedIssue } from "@/types";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_LABELS, fmtScore, scoreInk } from "@/lib/design";
import {
  MOCK_RANKED_ISSUES,
  MOCK_LOVES,
  MOCK_LOCATIONS,
  MOCK_MATRIX,
  MOCK_NEEDS_ATTENTION,
  MOCK_RECOVERY,
  MOCK_WEEK,
  mockTrendData,
  mockGroupTrend,
} from "@/lib/mock-data";

type TabId = "issues" | "loves" | "trends";

export default function DashboardPage() {
  const [activeLocation, setActiveLocation] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("issues");
  const [exportIssue, setExportIssue] = useState<RankedIssue | null>(null);
  const issuesRef = useRef<HTMLDivElement>(null);

  const locationNames = Object.fromEntries(
    MOCK_LOCATIONS.map((l) => [l.id, l.name])
  );

  // The weakest link: lowest-rated location + its worst category
  const weakestLocation = MOCK_LOCATIONS.reduce((worst, loc) =>
    (loc.rating ?? 5) < (worst.rating ?? 5) ? loc : worst
  );
  const weakestCategory = CATEGORIES.reduce((worst, cat) =>
    MOCK_MATRIX[weakestLocation.id][cat].score <
    MOCK_MATRIX[weakestLocation.id][worst].score
      ? cat
      : worst
  );
  const weakestIssues = MOCK_RANKED_ISSUES.filter(
    (i) => i.location_id === weakestLocation.id
  );
  const weakestTopQuote =
    weakestIssues.find((i) => i.category === weakestCategory)?.quotes[0] ??
    weakestIssues[0]?.quotes[0] ??
    "";

  function focusWeakestLink(locationId?: string) {
    setActiveLocation(locationId ?? weakestLocation.id);
    setActiveTab("issues");
    issuesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filteredIssues =
    activeLocation === "all"
      ? MOCK_RANKED_ISSUES
      : MOCK_RANKED_ISSUES.filter((i) => i.location_id === activeLocation);

  const filteredLoves =
    activeLocation === "all"
      ? MOCK_LOVES
      : MOCK_LOVES.filter((i) => i.location_id === activeLocation);

  const TABS = [
    { id: "issues" as TabId, label: "Fix these first", count: filteredIssues.length },
    { id: "loves" as TabId, label: "What guests love", count: filteredLoves.length },
    { id: "trends" as TabId, label: "Category trends", count: null },
  ];

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto space-y-7">
      {/* ── Editorial header ── */}
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          The week of June 29 · {MOCK_WEEK.new_reviews} new reviews
        </p>
        <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
          Guests love the {CATEGORY_LABELS[MOCK_WEEK.best.category].toLowerCase()}{" "}
          at {MOCK_WEEK.best.location} —{" "}
          <span className="text-neg">
            {CATEGORY_LABELS[MOCK_WEEK.worst.category].toLowerCase()} at{" "}
            {MOCK_WEEK.worst.location} needs you first
          </span>
          .
        </h1>
      </div>

      {/* ── Danger flags first, always ── */}
      <NeedsAttentionBanner items={MOCK_NEEDS_ATTENTION} />

      {/* ── Spotlight + whole-business trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <WeakestLinkSpotlight
          location={weakestLocation}
          worstCategory={weakestCategory}
          cell={MOCK_MATRIX[weakestLocation.id][weakestCategory]}
          openIssueCount={weakestIssues.length}
          topQuote={weakestTopQuote}
          onReview={() => focusWeakestLink()}
        />
        <GroupTrendChart data={mockGroupTrend()} />
      </div>

      {/* ── Cross-location heatmap ── */}
      <CrossLocationHeatmap onSelectLocation={(id) => focusWeakestLink(id)} />

      {/* ── The ranked list ── */}
      <div ref={issuesRef} className="scroll-mt-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex gap-1 border-b border-line flex-1 min-w-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-forest text-ink"
                    : "border-transparent text-ink-faint hover:text-ink-soft"
                )}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums",
                      tab.id === "issues"
                        ? "bg-[#fbeeea] text-neg"
                        : "bg-[#eef6f1] text-pos"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Location filter */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button
            onClick={() => setActiveLocation("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all",
              activeLocation === "all"
                ? "bg-forest text-paper border-forest"
                : "bg-paper text-ink-soft border-line hover:border-ink-faint"
            )}
          >
            All locations
          </button>
          {MOCK_LOCATIONS.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setActiveLocation(loc.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all",
                activeLocation === loc.id
                  ? "bg-forest text-paper border-forest"
                  : "bg-paper text-ink-soft border-line hover:border-ink-faint"
              )}
            >
              {loc.name}
              {loc.rating && (
                <span className="ml-1.5 opacity-60 tabular-nums">
                  {loc.rating.toFixed(1)}★
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Fix these first */}
        {activeTab === "issues" && (
          <div className="space-y-3">
            {filteredIssues.length === 0 ? (
              <p className="text-center py-12 text-sm text-ink-faint">
                Nothing needs fixing at this location. Enjoy it.
              </p>
            ) : (
              filteredIssues.map((issue, i) => (
                <RankedIssueCard
                  key={`${issue.category}-${issue.location_id}`}
                  issue={issue}
                  rank={i + 1}
                  onExport={setExportIssue}
                />
              ))
            )}
            {(activeLocation === "all" ||
              activeLocation === MOCK_RECOVERY.location_id) && (
              <ProofOfImpactCard
                recovery={MOCK_RECOVERY}
                locationName={
                  locationNames[MOCK_RECOVERY.location_id] ?? "your location"
                }
              />
            )}
          </div>
        )}

        {/* What guests love */}
        {activeTab === "loves" && (
          <div className="space-y-3">
            {filteredLoves.length === 0 ? (
              <p className="text-center py-12 text-sm text-ink-faint">
                No standout highlights at this location yet.
              </p>
            ) : (
              filteredLoves.map((issue, i) => (
                <RankedIssueCard
                  key={`${issue.category}-${issue.location_id}`}
                  issue={issue}
                  rank={i + 1}
                />
              ))
            )}
          </div>
        )}

        {/* Category trends */}
        {activeTab === "trends" && (
          <div className="bg-paper rounded-2xl border border-line p-6 space-y-5">
            <p className="text-sm text-ink-soft">
              Weekly sentiment by category across the last 90 days. Verbatim
              quotes come only from the rolling 30-day window — that&apos;s
              what guests are saying right now.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-7">
              {CATEGORIES.map((cat) => {
                const data = mockTrendData(cat);
                const lastScore = data[data.length - 1]?.score ?? 0;
                const firstScore = data[0]?.score ?? 0;
                const change = lastScore - firstScore;
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-heading text-[15px] font-semibold text-ink">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{ color: scoreInk(lastScore) }}
                      >
                        {fmtScore(lastScore)}
                        <span
                          className="text-[11px] font-semibold ml-1.5"
                          style={{ color: scoreInk(change) }}
                        >
                          {change < 0 ? "▼" : "▲"} {fmtScore(change)}
                        </span>
                      </span>
                    </div>
                    <SentimentTrendChart data={data} id={cat} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Monday brief ── */}
      <MondayBriefCard />

      {/* Shift meeting card modal */}
      {exportIssue && (
        <ShiftMeetingCard
          issue={exportIssue}
          onClose={() => setExportIssue(null)}
        />
      )}
    </div>
  );
}
