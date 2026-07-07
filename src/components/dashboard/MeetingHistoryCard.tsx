"use client";

import { ChevronRight, CalendarDays } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/design";
import type { Meeting } from "@/types";

interface MeetingHistoryCardProps {
  meeting: Meeting;
  onOpen: () => void;
}

export default function MeetingHistoryCard({ meeting, onOpen }: MeetingHistoryCardProps) {
  const scope = meeting.filters.location_ids?.length
    ? `${meeting.filters.location_ids.length} location${meeting.filters.location_ids.length !== 1 ? "s" : ""}`
    : meeting.filters.city
    ? meeting.filters.city
    : "All locations";
  const categoryLabel = meeting.filters.categories?.length
    ? meeting.filters.categories.map((c) => CATEGORY_LABELS[c]).join(", ")
    : "All categories";

  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-paper rounded-2xl border border-line p-5 hover:border-ink-faint transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="font-heading text-base font-semibold text-ink">{meeting.title}</p>
          <div className="flex items-center gap-3 flex-wrap text-xs text-ink-faint">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {meeting.filters.date_start} to {meeting.filters.date_end}
            </span>
            <span>{scope}</span>
            <span>{categoryLabel}</span>
            <span>{meeting.agenda.length} discussion item{meeting.agenda.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-faint shrink-0 mt-1" />
      </div>
    </button>
  );
}
