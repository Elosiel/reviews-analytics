"use client";

import { useState } from "react";
import MeetingFilterBar from "@/components/dashboard/MeetingFilterBar";
import MeetingHistoryCard from "@/components/dashboard/MeetingHistoryCard";
import MeetingAgendaModal from "@/components/dashboard/MeetingAgendaModal";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS } from "@/lib/design";
import { MOCK_RANKED_ISSUES, MOCK_MEETING_QUOTES } from "@/lib/mock-data";
import type {
  Location,
  Meeting,
  MeetingAgendaIssue,
  MeetingQuoteSnapshot,
  RankedIssue,
  SentimentCategory,
  Sop,
} from "@/types";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return { start: isoDate(start), end: isoDate(end) };
}

// DB row (flat columns) → UI Meeting shape (nested filters)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToMeeting(row: any): Meeting {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    title: row.title,
    filters: {
      location_ids: row.location_ids ?? null,
      city: row.city ?? null,
      categories: row.categories ?? null,
      date_start: row.date_start,
      date_end: row.date_end,
    },
    agenda: (row.agenda ?? []) as MeetingAgendaIssue[],
    generated_at: row.generated_at,
    created_by: row.created_by,
  };
}

// Demo-mode agenda builder (real mode uses /api/meetings/generate + Claude)
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

interface MeetingsPageClientProps {
  locations: Location[];
  initialMeetings: Meeting[];
  sops: Sop[];
  demo: boolean;
}

export default function MeetingsPageClient({
  locations,
  initialMeetings,
  sops,
  demo,
}: MeetingsPageClientProps) {
  const defaults = defaultDateRange();
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [openMeeting, setOpenMeeting] = useState<Meeting | null>(null);
  const [openQuotes, setOpenQuotes] = useState<MeetingQuoteSnapshot[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function openMeetingWithQuotes(meeting: Meeting) {
    setOpenMeeting(meeting);
    if (demo) {
      setOpenQuotes(MOCK_MEETING_QUOTES[meeting.id] ?? []);
      return;
    }
    // Verbatim snapshots load on demand — RLS scopes to own tenant
    const supabase = createClient();
    const { data } = await supabase
      .from("meeting_quote_snapshots")
      .select("*")
      .eq("meeting_id", meeting.id)
      .not("quote_text", "is", null);
    setOpenQuotes((data ?? []) as MeetingQuoteSnapshot[]);
  }

  function generateDemoMeeting() {
    const matchingLocationIds = selectedLocationIds.length
      ? selectedLocationIds
      : city
      ? locations
          .filter((l) => l.address?.toLowerCase().includes(city.toLowerCase()))
          .map((l) => l.id)
      : locations.map((l) => l.id);

    const issues = MOCK_RANKED_ISSUES.filter(
      (i) =>
        matchingLocationIds.includes(i.location_id) &&
        (selectedCategories.length === 0 || selectedCategories.includes(i.category))
    );
    if (issues.length === 0) return;

    const activeSopByCategory = new Map(
      sops.filter((s) => s.status === "active").map((s) => [s.category, s.id])
    );
    const agenda = issues.map((i) => toAgendaIssue(i, activeSopByCategory.get(i.category)));

    const locationLabel = selectedLocationIds.length
      ? locations
          .filter((l) => selectedLocationIds.includes(l.id))
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
    setOpenQuotes([]);
  }

  async function generateMeeting() {
    setError(null);
    if (demo) {
      generateDemoMeeting();
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/meetings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_ids: selectedLocationIds.length ? selectedLocationIds : undefined,
          city: city || undefined,
          categories: selectedCategories.length ? selectedCategories : undefined,
          date_start: dateStart,
          date_end: dateEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate meeting");
      const meeting = rowToMeeting(data.data);
      setMeetings((prev) => [meeting, ...prev]);
      await openMeetingWithQuotes(meeting);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate meeting");
    } finally {
      setGenerating(false);
    }
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

      {error && (
        <p className="text-sm text-neg bg-[#fbeeea] rounded-lg px-4 py-3">{error}</p>
      )}

      <MeetingFilterBar
        locations={locations}
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
        generating={generating}
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
              <MeetingHistoryCard key={m.id} meeting={m} onOpen={() => openMeetingWithQuotes(m)} />
            ))
          )}
        </div>
      </div>

      {openMeeting && (
        <MeetingAgendaModal
          meeting={openMeeting}
          quotes={openQuotes}
          sops={sops}
          onClose={() => setOpenMeeting(null)}
        />
      )}
    </div>
  );
}
