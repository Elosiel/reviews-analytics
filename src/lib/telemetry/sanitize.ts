/**
 * What product events and error logs may contain. Everything is
 * allowlisted: unknown event types are dropped, metadata keeps only known
 * keys with short scalar values, and free text is scrubbed of anything that
 * looks like a credential before it's stored.
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

/** Events the browser may report via POST /api/events. */
export const CLIENT_EVENT_TYPES = [
  "login",
  "logout",
  "page_viewed",
  "location_viewed",
  "tab_changed",
  "filter_used",
  "date_range_changed",
  "insight_opened",
  "report_opened",
  "pdf_downloaded",
  "feedback_opened",
] as const;

/** Events only server code records (never accepted from the browser). */
export const SERVER_EVENT_TYPES = [
  "signup",
  "google_connected",
  "google_connection_broken",
  "location_added",
  "location_removed",
  "team_invite_sent",
  "team_invite_accepted",
  "team_member_removed",
  "feedback_submitted",
  "sop_drafted",
  "meeting_generated",
  "report_generated",
] as const;

export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];
export type ServerEventType = (typeof SERVER_EVENT_TYPES)[number];
export type EventType = ClientEventType | ServerEventType;

export function isClientEventType(t: unknown): t is ClientEventType {
  return typeof t === "string" && (CLIENT_EVENT_TYPES as readonly string[]).includes(t);
}

const METADATA_KEYS = new Set([
  "path", "tab", "category", "range", "filter", "location_id", "report_id", "count", "kind", "source", "type",
]);
const MAX_VALUE_LENGTH = 120;

/** Keeps only allowlisted keys with short string/number/boolean values. */
export function sanitizeEventMetadata(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!METADATA_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = redactSecrets(k === "path" ? stripQuery(v) : v).slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

/** Paths are kept without query strings or fragments (they can carry tokens/codes). */
export function stripQuery(path: string): string {
  return path.split(/[?#]/)[0];
}

const SECRET_PATTERNS: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]"],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted-jwt]"],
  [/\bya29\.[A-Za-z0-9_-]+/g, "[redacted-google-token]"],
  [/\b1\/\/[A-Za-z0-9_-]{20,}/g, "[redacted-google-refresh]"],
  [/\bsk-ant-[A-Za-z0-9_-]+/g, "[redacted-api-key]"],
  [/\bre_[A-Za-z0-9]{20,}/g, "[redacted-api-key]"],
  [/((?:access|refresh|id)_token|client_secret|password|api[_-]?key|secret|code|token_hash)(["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, "$1$2[redacted]"],
  [/\b[0-9a-f]{64}\b/gi, "[redacted-hex]"],
];

/** Scrubs things that look like credentials from free text (error messages, metadata). */
export function redactSecrets(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

export const ERROR_CATEGORIES = ["sync", "analysis", "rollup", "google_auth", "auth", "api", "job", "feedback", "admin"] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/** Error message safe to store: credentials scrubbed, no stack trace, bounded length. */
export function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "Unknown error");
  return redactSecrets(String(raw).split("\n")[0]).slice(0, 500);
}

export const FEEDBACK_TYPES = ["bug", "improvement", "feature", "general", "support"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_STATUSES = ["new", "in_review", "planned", "resolved", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export interface FeedbackInput {
  type: FeedbackType;
  subject: string;
  message: string;
  rating: number | null;
  route: string | null;
  locationId: string | null;
}

/** Validates the customer-submitted part of a feedback form. Identity and tenant are never taken from here. */
export function parseFeedbackInput(body: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!(FEEDBACK_TYPES as readonly string[]).includes(b.type as string)) return { ok: false, error: "Choose a feedback type." };
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!subject) return { ok: false, error: "Add a short subject." };
  if (subject.length > 200) return { ok: false, error: "Keep the subject under 200 characters." };
  if (!message) return { ok: false, error: "Tell us a bit more in the message." };
  if (message.length > 5000) return { ok: false, error: "Keep the message under 5,000 characters." };
  let rating: number | null = null;
  if (b.rating !== undefined && b.rating !== null && b.rating !== "") {
    const r = Number(b.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return { ok: false, error: "Rating must be 1–5." };
    rating = r;
  }
  const route = typeof b.route === "string" && b.route.startsWith("/") ? stripQuery(b.route).slice(0, 200) : null;
  const locationId =
    typeof b.locationId === "string" && /^[0-9a-f-]{36}$/i.test(b.locationId) ? b.locationId : null;
  return { ok: true, value: { type: b.type as FeedbackType, subject, message, rating, route, locationId } };
}
