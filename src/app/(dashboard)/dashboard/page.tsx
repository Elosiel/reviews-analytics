"use client";

import { useState } from "react";
import { Star, MessageSquareText, ListChecks, MapPin } from "lucide-react";
import RankedIssueCard from "@/components/dashboard/RankedIssueCard";
import DriftAlertBanner from "@/components/dashboard/DriftAlertBanner";
import ShiftMeetingCard from "@/components/dashboard/ShiftMeetingCard";
import NeedsAttentionBanner from "@/components/dashboard/NeedsAttentionBanner";
import ProofOfImpactCard from "@/components/dashboard/ProofOfImpactCard";
import MondayBriefCard from "@/components/dashboard/MondayBriefCard";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import type { RankedIssue } from "@/types";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  fmtScore,
  scoreInk,
} from "@/lib/design";
import {
  MOCK_RANKED_ISSUES,
  MOCK_LOVES,
  MOCK_DRIFT_ALERTS,
  MOCK_LOCATIONS,
  MOCK_NEEDS_ATTENTION,
  MOCK_RECOVERY,
  MOCK_WEEK,
  mockTrendData,
} from "@/lib/mock-data";

const TIME_WINDOWS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];
type TabId = "issues" | "loves" | "trends";

export default function DashboardPage() {
  const [timeWindow, setTimeWindow] = useState(30);
  const [activeLocation, setActiveLocation] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("issues");
  const [exportIssue, setExportIssue] = useState<RankedIssue | null>(null);

  const locationNames = Object.fromEntries(
    MOCK_LOCATIONS.map((l) => [l.id, l.name])
  );

  const filteredIssues =
    activeLocation === "all"
      ? MOCK_RANKED_ISSUES
      : MOCK_RANKED_ISSUES.filter((i) => i.location_id === activeLocation);

  const filteredLoves =
    activeLocation === "all"
      ? MOCK_LOVES
      : MOCK_LOVES.filter((i) => i.location_id === activeLocation);

  const avgRating =
    MOCK_LOCATIONS.reduce((sum, l) => sum + (l.rating ?? 0), 0) /
    MOCK_LOCATIONS.length;
  const totalReviews = MOCK_LOCATIONS.reduce(
    (sum, l) => sum + l.review_count,
    0
  );

  const TABS = [
    { id: "issues" as TabId, label: "Fix these first", count: filteredIssues.length },
    { id: "loves" as TabId, label: "What guests love", count: filteredLoves.length },
    { id: "trends" as TabId, label: "Trends", count: null },
  ];

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto space-y-7">
      {/* ── Editorial header ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
            The week of June 29
          </p>
          <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
            {MOCK_WEEK.new_reviews} new reviews.
            <br />
            Guests love the {CATEGORY_LABELS[MOCK_WEEK.best.category].toLowerCase()} at{" "}
            {MOCK_WEEK.best.location} —{" "}
            <span className="text-neg">
              {CATEGORY_LABELS[MOCK_WEEK.worst.category].toLowerCase()} at{" "}
              {MOCK_WEEK.worst.location} needs you first
            </span>
            .
          </h1>
        </div>
        <div className="flex items-center gap-1 bg-paper border border-line rounded-xl p-1">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setTimeWindow(w.value)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                timeWindow === w.value
                  ? "bg-forest text-paper shadow-sm"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Danger flags first, always ── */}
      <NeedsAttentionBanner items={MOCK_NEEDS_ATTENTION} />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-paper rounded-2xl border border-line p-5">
          <div className="flex items-center gap-1.5 text-ink-faint">
            <Star className="w-3.5 h-3.5" />
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium">
              Group rating
            </p>
          </div>
          <p className="text-[28px] font-bold text-ink mt-1 tabular-nums">
            {avgRating.toFixed(1)}
            <span className="text-gold text-xl ml-0.5">★</span>
          </p>
          <p className="text-xs mt-0.5">
            <span className="text-pos font-semibold">
              ▲ +{MOCK_WEEK.rating_delta.toFixed(1)}
            </span>{" "}
            <span className="text-ink-faint">this week</span>
          </p>
        </div>
        <div className="bg-paper rounded-2xl border border-line p-5">
          <div className="flex items-center gap-1.5 text-ink-faint">
            <MessageSquareText className="w-3.5 h-3.5" />
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium">
              Reviews analyzed
            </p>
          </div>
          <p className="text-[28px] font-bold text-ink mt-1 tabular-nums">
            {totalReviews.toLocaleString()}
          </p>
          <p className="text-xs text-ink-faint mt-0.5">
            every one, categorized by AI
          </p>
        </div>
        <div className="bg-paper rounded-2xl border border-line p-5">
          <div className="flex items-center gap-1.5 text-ink-faint">
            <ListChecks className="w-3.5 h-3.5" />
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium">
              Open issues
            </p>
          </div>
          <p className="text-[28px] font-bold text-ink mt-1 tabular-nums">
            {MOCK_RANKED_ISSUES.length}
          </p>
          <p className="text-xs text-ink-faint mt-0.5">
            ranked by guest impact
          </p>
        </div>
        <div className="bg-paper rounded-2xl border border-line p-5">
          <div className="flex items-center gap-1.5 text-ink-faint">
            <MapPin className="w-3.5 h-3.5" />
            <p className="text-[11px] uppercase tracking-[0.12em] font-medium">
              Weakest link
            </p>
          </div>
          <p className="font-heading text-xl font-semibold text-ink mt-1.5">
            {MOCK_WEEK.worst.location}
          </p>
          <p className="text-xs mt-0.5">
            <span className="text-neg font-semibold">
              {CATEGORY_LABELS[MOCK_WEEK.worst.category]}
            </span>{" "}
            <span className="text-ink-faint">dragging the group</span>
          </p>
        </div>
      </div>

      {/* ── Drift alerts ── */}
      {MOCK_DRIFT_ALERTS.length > 0 && (
        <DriftAlertBanner
          alerts={MOCK_DRIFT_ALERTS}
          locationNames={locationNames}
        />
      )}

      {/* ── Location filter ── */}
      <div className="flex items-center gap-2 flex-wrap">
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

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 border-b border-line">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
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

        <div className="mt-5">
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

          {/* Trends */}
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
