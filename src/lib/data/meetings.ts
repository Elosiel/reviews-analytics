import type { Meeting, MeetingAgendaIssue } from "@/types";

// DB row (flat columns) → UI Meeting shape (nested filters). Lives outside
// any "use client" file because the server-rendered Meetings page calls it.
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
