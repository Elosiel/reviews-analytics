"use client";

import { useRef, useState } from "react";
import RankedIssueCard from "@/components/dashboard/RankedIssueCard";
import RecommendationsTable from "@/components/dashboard/RecommendationsTable";
import ShiftMeetingCard from "@/components/dashboard/ShiftMeetingCard";
import NeedsAttentionBanner from "@/components/dashboard/NeedsAttentionBanner";
import ProofOfImpactCard from "@/components/dashboard/ProofOfImpactCard";
import MondayBriefCard from "@/components/dashboard/MondayBriefCard";
import WeakestLinkSpotlight from "@/components/dashboard/WeakestLinkSpotlight";
import CrossLocationHeatmap from "@/components/dashboard/CrossLocationHeatmap";
import GroupTrendChart from "@/components/charts/GroupTrendChart";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import type {
  RankedIssue,
  Location,
  SentimentCategory,
  MatrixCell,
  NeedsAttentionItem,
  DriftAlert,
} from "@/types";
import type { TrendPoint, WeekSummary } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_LABELS, fmtScore, scoreInk } from "@/lib/design";

type TabId = "issues" | "loves" | "trends" | "recommendations";

interface DashboardOverviewClientProps {
  locations: Location[];
  matrix: Record<string, Record<SentimentCategory, MatrixCell>>;
  rankedIssues: RankedIssue[];
  loves: RankedIssue[];
  needsAttention: NeedsAttentionItem[];
  recovery: DriftAlert | null;
  week: WeekSummary;
  groupTrend: TrendPoint[];
  trendsByCategory: Record<SentimentCategory, TrendPoint[]>;
}

export default function DashboardOverviewClient({
  locations,
  matrix,
  rankedIssues,
  loves,
  needsAttention,
  recovery,
  week,
  groupTrend,
  trendsByCategory,
}: DashboardOverviewClientProps) {
  const [activeLocation, setActiveLocation] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("issues");
  const [exportIssue, setExportIssue] = useState<RankedIssue | null>(null);
  const issuesRef = useRef<HTMLDivElement>(null);

  const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  // The weakest link: lowest-rated location + its worst category.
  // Only categories guests actually mentioned count — a zero-mention
  // category defaults to 0.00 and would otherwise "beat" every positive
  // score with a meaningless empty cell.
  const weakestLocation = locations.reduce((worst, loc) =>
    (loc.rating ?? 5) < (worst.rating ?? 5) ? loc : worst
  );
  const mentionedCategories = CATEGORIES.filter(
    (cat) => matrix[weakestLocation.id][cat].mentions > 0
  );
  const weakestCategory = (mentionedCategories.length > 0 ? mentionedCategories : CATEGORIES).reduce(
    (worst, cat) =>
      matrix[weakestLocation.id][cat].score < matrix[weakestLocation.id][worst].score
        ? cat
        : worst
  );
  const weakestIssues = rankedIssues.filter(
    (i) => i.location_id === weakestLocation.id
  );
  // When the location has no negative issues (all categories positive),
  // fall back to what guests are actually saying there rather than
  // rendering an empty quote.
  const weakestTopQuote =
    weakestIssues.find((i) => i.category === weakestCategory)?.quotes[0] ??
    weakestIssues[0]?.quotes[0] ??
    loves.find((i) => i.location_id === weakestLocation.id && i.category === weakestCategory)
      ?.quotes[0] ??
    loves.find((i) => i.location_id === weakestLocation.id)?.quotes[0] ??
    "";

  function focusWeakestLink(locationId?: string) {
    setActiveLocation(locationId ?? weakestLocation.id);
    setActiveTab("issues");
    issuesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filteredIssues =
    activeLocation === "all"
      ? rankedIssues
      : rankedIssues.filter((i) => i.location_id === activeLocation);

  const filteredLoves =
    activeLocation === "all"
      ? loves
      : loves.filter((i) => i.location_id === activeLocation);

  const filteredRecommendations = filteredIssues.filter((i) => i.recommendation);

  const TABS = [
    { id: "issues" as TabId, label: "Fix these first", count: filteredIssues.length },
    { id: "loves" as TabId, label: "What guests love", count: filteredLoves.length },
    { id: "trends" as TabId, label: "Category trends", count: null },
    {
      id: "recommendations" as TabId,
      label: "Recommendations",
      count: filteredRecommendations.length,
    },
  ];

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto space-y-7">
      {/* ── Editorial header ── */}
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          This week · {week.new_reviews} new review{week.new_reviews !== 1 ? "s" : ""}
        </p>
        <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
          {week.best && week.worst ? (
            <>
              Guests love the {CATEGORY_LABELS[week.best.category].toLowerCase()}{" "}
              at {week.best.location} —{" "}
              <span className="text-neg">
                {CATEGORY_LABELS[week.worst.category].toLowerCase()} at{" "}
                {week.worst.location} needs you first
              </span>
              .
            </>
          ) : (
            "Here's what your guests are saying."
          )}
        </h1>
      </div>

      {/* ── Monday brief — the headline story, delivered ── */}
      <MondayBriefCard />

      {/* ── Danger flags first, always ── */}
      <NeedsAttentionBanner items={needsAttention} />

      {/* ── Spotlight + whole-business trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <WeakestLinkSpotlight
          location={weakestLocation}
          worstCategory={weakestCategory}
          cell={matrix[weakestLocation.id][weakestCategory]}
          openIssueCount={weakestIssues.length}
          topQuote={weakestTopQuote}
          onReview={() => focusWeakestLink()}
        />
        <GroupTrendChart data={groupTrend} />
      </div>

      {/* ── Cross-location heatmap ── */}
      <CrossLocationHeatmap
        locations={locations}
        matrix={matrix}
        onSelectLocation={(id) => focusWeakestLink(id)}
      />

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
          {locations.map((loc) => (
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
            {recovery &&
              (activeLocation === "all" || activeLocation === recovery.location_id) && (
                <ProofOfImpactCard
                  recovery={recovery}
                  locationName={locationNames[recovery.location_id] ?? "your location"}
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
                const data = trendsByCategory[cat];
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
                    {data.length > 0 ? (
                      <SentimentTrendChart data={data} id={cat} />
                    ) : (
                      <p className="text-xs text-ink-faint py-6 text-center">
                        Not enough weeks of data yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendations — the consolidated to-do list */}
        {activeTab === "recommendations" && (
          <RecommendationsTable
            issues={filteredIssues}
            onExport={setExportIssue}
          />
        )}
      </div>

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
