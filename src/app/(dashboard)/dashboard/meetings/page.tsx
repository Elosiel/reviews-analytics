"use client";

import { useState } from "react";
import MeetingFilterBar from "@/components/dashboard/MeetingFilterBar";
import MeetingHistoryCard from "@/components/dashboard/MeetingHistoryCard";
import MeetingAgendaModal from "@/components/dashboard/MeetingAgendaModal";
import { CATEGORY_LABELS } from "@/lib/design";
import {
  MOCK_LOCATIONS,
  MOCK_RANKED_ISSUES,
  MOCK_SOPS,
  MOCK_MEETINGS,
  MOCK_MEETING_QUOTES,
} from "@/lib/mock-data";
import type { Meeting, MeetingAgendaIssue, RankedIssue, SentimentCategory } from "@/types";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return { start: isoDate(start), end: isoDate(end) };
}

// Discussion point is a fresh paraphrase of the trend; suggested action
// reuses the issue's own recommendation — that's already written as
// operator-ready advice, no need to regenerate it for the agenda.
function toAgendaIssue(issue: RankedIssue, linkedSopId?: string): MeetingAgendaIssue {
  return {
    category: issue.category,
    location_id: issue.location_id,
    location_name: issue.location_name,
    mention_count: issue.mention_count,
    avg_sentiment_score: issue.avg_sentiment_score,
    sentiment_delta: issue.sentiment_delta,
    severity: issue.severity,
    discussion_point: `${issue.mention_count} guests mentioned ${CATEGORY_LABELS[
      issue.category
    ].toLowerCase()} at ${issue.location_name} in the last 30 days${
      issue.sentiment_delta !== null && issue.sentiment_delta < 0 ? ", and it's trending worse" : ""
    }.`,
    suggested_action:
      issue.recommendation ??
      `Walk the team through ${CATEGORY_LABELS[issue.category].toLowerCase()} standards at ${issue.location_name} before next service.`,
    linked_sop_id: linkedSopId,
  };
}

export default function MeetingsPage() {
  const defaults = defaultDateRange();
  const [meetings, setMeetings] = useState<Meeting[]>(MOCK_MEETINGS);
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);

  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<SentimentCategory[]>([]);
  const [dateStart, setDateStart] = useState(defaults.start);
  const [dateEnd, setDateEnd] = useState(defaults.end);

  function toggleLocation(id: string) {
    setSelectedLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function toggleCategory(cat: SentimentCategory) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
    );
  }

  function generateMeeting() {
    const matchingLocationIds = selectedLocationIds.length
      ? selectedLocationIds
      : city
      ? MOCK_LOCATIONS.filter((l) =>
          l.address?.toLowerCase().includes(city.toLowerCase())
        ).map((l) => l.id)
      : MOCK_LOCATIONS.map((l) => l.id);

    const issues = MOCK_RANKED_ISSUES.filter(
      (i) =>
        matchingLocationIds.includes(i.location_id) &&
        (selectedCategories.length === 0 || selectedCategories.includes(i.category))
    );
    if (issues.length === 0) return;

    const activeSopByCategory = new Map(
      MOCK_SOPS.filter((s) => s.status === "active").map((s) => [s.category, s.id])
    );
    const agenda = issues.map((i) => toAgendaIssue(i, activeSopByCategory.get(i.category)));

    const locationLabel = selectedLocationIds.length
      ? MOCK_LOCATIONS.filter((l) => selectedLocationIds.includes(l.id))
          .map((l) => l.name)
          .join(", ")
      : city || "All locations";
    const categoryLabel = selectedCategories.length
      ? ` — ${selectedCategories.map((c) => CATEGORY_LABELS[c]).join(", ")}`
      : "";

    const meeting: Meeting = {
      id: `meeting-${Date.now()}`,
      tenant_id: "tenant-1",
      title: `${locationLabel}${categoryLabel} · ${dateStart} to ${dateEnd}`,
      filters: {
        location_ids: selectedLocationIds.length ? selectedLocationIds : null,
        city: city || null,
        categories: selectedCategories.length ? selectedCategories : null,
        date_start: dateStart,
        date_end: dateEnd,
      },
      agenda,
      generated_at: new Date().toISOString(),
      created_by: "user-1",
    };

    setMeetings((prev) => [meeting, ...prev]);
    setOpenMeeting(meeting);
  }

  // A saved meeting's own filters double as its "tags" — null means the
  // meeting already covers everything, so it matches any narrower filter.
  function matchesFilters(m: Meeting): boolean {
    if (selectedLocationIds.length > 0 && m.filters.location_ids) {
      if (!m.filters.location_ids.some((id) => selectedLocationIds.includes(id))) return false;
    }
    if (city.trim() && m.filters.city) {
      if (!m.filters.city.toLowerCase().includes(city.trim().toLowerCase())) return false;
    }
    if (selectedCategories.length > 0 && m.filters.categories) {
      if (!m.filters.categories.some((c) => selectedCategories.includes(c))) return false;
    }
    if (dateStart && m.filters.date_end < dateStart) return false;
    if (dateEnd && m.filters.date_start > dateEnd) return false;
    return true;
  }

  const filteredHistory = meetings.filter(matchesFilters);

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto space-y-7">
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          Meetings
        </p>
        <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
          Walk in with the agenda already built.
        </h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">
          Pick a location, city, date range, and category — RAAI turns the matching
          reviews into discussion points and suggested actions, ready for tonight&apos;s
          shift meeting or Monday&apos;s team huddle.
        </p>
      </div>

      <MeetingFilterBar
        locations={MOCK_LOCATIONS}
        selectedLocationIds={selectedLocationIds}
        onToggleLocation={toggleLocation}
        city={city}
        onCityChange={setCity}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        dateStart={dateStart}
        dateEnd={dateEnd}
        onDateStartChange={setDateStart}
        onDateEndChange={setDateEnd}
        onGenerate={generateMeeting}
      />

      <div>
        <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-3">
          History
          {filteredHistory.length !== meetings.length
            ? ` · ${filteredHistory.length} of ${meetings.length}`
            : ""}
        </p>
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <p className="text-center py-12 text-sm text-ink-faint">
              No saved meetings match these filters yet.
            </p>
          ) : (
            filteredHistory.map((m) => (
              <MeetingHistoryCard key={m.id} meeting={m} onOpen={() => setOpenMeeting(m)} />
            ))
          )}
        </div>
      </div>

      {openMeeting && (
        <MeetingAgendaModal
          meeting={openMeeting}
          quotes={MOCK_MEETING_QUOTES[openMeeting.id] ?? []}
          sops={MOCK_SOPS}
          onClose={() => setOpenMeeting(null)}
        />
      )}
    </div>
  );
}
