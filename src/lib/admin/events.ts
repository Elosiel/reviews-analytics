// Human-readable labels for the activity timeline.

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/locations": "Locations",
  "/dashboard/reports": "Reports",
  "/dashboard/sops": "SOPs",
  "/dashboard/meetings": "Meetings",
  "/dashboard/settings": "Settings",
  "/dashboard/restaurant": "Your restaurant",
  "/onboarding": "Onboarding",
};

const LABELS: Record<string, string> = {
  signup: "Created an account",
  login: "Signed in",
  logout: "Signed out",
  google_connected: "Connected Google Business Profile",
  google_connection_broken: "Google connection broke",
  location_added: "Added a location",
  location_removed: "Removed a location",
  team_invite_sent: "Invited a teammate",
  team_invite_accepted: "Joined the team",
  team_member_removed: "Removed a teammate",
  feedback_submitted: "Sent feedback",
  feedback_opened: "Opened the feedback form",
  sop_drafted: "Drafted an SOP",
  meeting_generated: "Generated a meeting agenda",
  report_generated: "Generated a weekly report",
  report_opened: "Opened a weekly report",
  pdf_downloaded: "Downloaded a PDF",
  insight_opened: "Opened an insight",
  filter_used: "Used a filter",
  date_range_changed: "Changed the date range",
  tab_changed: "Switched tab",
  location_viewed: "Viewed a location",
};

export function describeEvent(e: { event_type: string; metadata: Record<string, unknown> }): string {
  const m = e.metadata ?? {};
  if (e.event_type === "page_viewed") {
    const path = typeof m.path === "string" ? m.path : "";
    return `Viewed ${PAGE_NAMES[path] ?? path ?? "a page"}`;
  }
  const base = LABELS[e.event_type] ?? e.event_type.replace(/_/g, " ");
  const extra = [m.tab, m.category, m.type, m.kind].filter((v) => typeof v === "string" && v).join(" · ");
  return extra ? `${base} — ${extra}` : base;
}

export const EVENT_FILTERS = Object.keys(LABELS).concat("page_viewed").sort();
