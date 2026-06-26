"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import RankedIssueCard from "@/components/dashboard/RankedIssueCard";
import DriftAlertBanner from "@/components/dashboard/DriftAlertBanner";
import ShiftMeetingCard from "@/components/dashboard/ShiftMeetingCard";
import SentimentTrendChart from "@/components/charts/SentimentTrendChart";
import type { RankedIssue, SentimentCategory } from "@/types";
import {
  MOCK_RANKED_ISSUES,
  MOCK_LOVES,
  MOCK_DRIFT_ALERTS,
  MOCK_LOCATIONS,
  mockTrendData,
} from "@/lib/mock-data";

const CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];
const CATEGORY_LABELS: Record<SentimentCategory, string> = {
  food: "Food", service: "Service", atmosphere: "Atmosphere",
  value: "Value", wait_time: "Wait Time", cleanliness: "Cleanliness",
};
const TIME_WINDOWS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];
type TabId = "issues" | "loves" | "trends";

export default function DashboardPage() {
  const [timeWindow, setTimeWindow] = useState(90);
  const [activeLocation, setActiveLocation] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TabId>("issues");
  const [exportIssue, setExportIssue] = useState<RankedIssue | null>(null);

  const locationNames = Object.fromEntries(
    MOCK_LOCATIONS.map((l) => [l.id, l.name])
  );

  const filteredIssues = activeLocation === "all"
    ? MOCK_RANKED_ISSUES
    : MOCK_RANKED_ISSUES.filter((i) => i.location_id === activeLocation);

  const filteredLoves = activeLocation === "all"
    ? MOCK_LOVES
    : MOCK_LOVES.filter((i) => i.location_id === activeLocation);

  const avgRating =
    MOCK_LOCATIONS.reduce((sum, l) => sum + (l.rating ?? 0), 0) /
    MOCK_LOCATIONS.length;
  const totalReviews = MOCK_LOCATIONS.reduce((sum, l) => sum + l.review_count, 0);

  const TABS = [
    { id: "issues" as TabId, label: "Fix These", count: filteredIssues.length, countColor: "bg-red-100 text-red-700" },
    { id: "loves" as TabId, label: "What They Love", count: filteredLoves.length, countColor: "bg-emerald-100 text-emerald-700" },
    { id: "trends" as TabId, label: "Sentiment Trends", count: null, countColor: "" },
  ];

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Overview</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Ranked operational intelligence across {MOCK_LOCATIONS.length} locations
          </p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.value}
              onClick={() => setTimeWindow(w.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                timeWindow === w.value
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Avg Rating", value: avgRating.toFixed(1) + " ★", sub: `${MOCK_LOCATIONS.length} locations`, color: "text-amber-500" },
          { label: "Total Reviews", value: totalReviews.toLocaleString(), sub: `last ${timeWindow} days`, color: "text-zinc-900" },
          { label: "Open Issues", value: String(filteredIssues.length), sub: "ranked by impact", color: "text-red-600" },
          { label: "Drift Alerts", value: String(MOCK_DRIFT_ALERTS.length), sub: "need attention", color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-zinc-100 p-4 space-y-1">
            <p className="text-xs text-zinc-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-zinc-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Drift alerts */}
      {MOCK_DRIFT_ALERTS.length > 0 && (
        <DriftAlertBanner alerts={MOCK_DRIFT_ALERTS} locationNames={locationNames} />
      )}

      {/* Location filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveLocation("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            activeLocation === "all"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
          }`}
        >
          All locations
        </button>
        {MOCK_LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setActiveLocation(loc.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeLocation === loc.id
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {loc.name}
            {loc.rating && <span className="ml-1.5 opacity-60">{loc.rating.toFixed(1)}★</span>}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-zinc-100">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <Badge className={`text-xs border-0 px-1.5 py-0 ${tab.countColor}`}>
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {/* Fix These */}
          {activeTab === "issues" && (
            <div className="space-y-3">
              {filteredIssues.length === 0 ? (
                <p className="text-center py-12 text-sm text-zinc-400">
                  No issues found for this location.
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
            </div>
          )}

          {/* What They Love */}
          {activeTab === "loves" && (
            <div className="space-y-3">
              {filteredLoves.length === 0 ? (
                <p className="text-center py-12 text-sm text-zinc-400">
                  No positive highlights found for this location.
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
            <div className="bg-white rounded-xl border border-zinc-100 p-6 space-y-5">
              <p className="text-sm text-zinc-500">
                90-day rolling sentiment by category. Quotes are from the last 30 days only.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {CATEGORIES.map((cat) => {
                  const data = mockTrendData(cat);
                  const lastScore = data[data.length - 1]?.score ?? 0;
                  const color = lastScore >= 0.2 ? "#10b981" : lastScore >= -0.1 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-700">
                          {CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-sm font-bold" style={{ color }}>
                          {lastScore > 0 ? "+" : ""}
                          {lastScore.toFixed(2)}
                        </span>
                      </div>
                      <SentimentTrendChart data={data} color={color} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shift meeting card modal */}
      {exportIssue && (
        <ShiftMeetingCard issue={exportIssue} onClose={() => setExportIssue(null)} />
      )}
    </div>
  );
}
