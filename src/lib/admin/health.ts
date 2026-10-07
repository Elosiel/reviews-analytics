/**
 * Customer health — transparent, rule-based statuses from real product data.
 * No scoring model: each status names the rule that triggered it, and every
 * matching rule is listed as a reason so the admin sees why.
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

export type HealthStatus =
  | "connection_issue"
  | "needs_attention"
  | "onboarding"
  | "trial_expiring"
  | "inactive"
  | "low_activity"
  | "healthy";

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  connection_issue: "Connection issue",
  needs_attention: "Needs attention",
  onboarding: "Onboarding",
  trial_expiring: "Trial expiring",
  inactive: "Inactive",
  low_activity: "Low activity",
  healthy: "Healthy",
};

export const HEALTH_RULES = {
  inactiveAfterDays: 14,
  lowActivityAfterDays: 7,
  trialExpiringWithinDays: 7,
} as const;

export interface HealthInput {
  locationCount: number;
  brokenLocationCount: number;
  /** Latest of last sign-in and last product event (not counting impersonation). */
  lastActivityAt: string | null;
  createdAt: string;
  /** Latest trial end across the account and its location extensions. */
  trialEndsAt: string | null;
  paid: boolean;
  openBugs: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function customerHealth(c: HealthInput, now: number = Date.now()): { status: HealthStatus; reasons: string[] } {
  const reasons: { status: HealthStatus; text: string }[] = [];
  const daysSince = (iso: string | null) => (iso ? (now - Date.parse(iso)) / DAY : Infinity);
  const trialMsLeft = c.trialEndsAt ? Date.parse(c.trialEndsAt) - now : null;

  if (c.brokenLocationCount > 0) {
    reasons.push({ status: "connection_issue", text: `Google connection broken on ${c.brokenLocationCount} location${c.brokenLocationCount === 1 ? "" : "s"}` });
  }
  if (c.openBugs > 0) {
    reasons.push({ status: "needs_attention", text: `${c.openBugs} open bug/support report${c.openBugs === 1 ? "" : "s"}` });
  }
  if (!c.paid && trialMsLeft !== null && trialMsLeft <= 0) {
    reasons.push({ status: "needs_attention", text: "Trial has ended" });
  }
  if (c.locationCount === 0) {
    reasons.push({ status: "onboarding", text: "No locations connected yet" });
  }
  if (!c.paid && trialMsLeft !== null && trialMsLeft > 0 && trialMsLeft <= HEALTH_RULES.trialExpiringWithinDays * DAY) {
    reasons.push({ status: "trial_expiring", text: `Trial ends in ${Math.ceil(trialMsLeft / DAY)} day${Math.ceil(trialMsLeft / DAY) === 1 ? "" : "s"}` });
  }
  const idle = daysSince(c.lastActivityAt);
  if (idle > HEALTH_RULES.inactiveAfterDays) {
    reasons.push({ status: "inactive", text: c.lastActivityAt ? `No activity in ${Math.floor(idle)} days` : "No recorded activity" });
  } else if (idle > HEALTH_RULES.lowActivityAfterDays) {
    reasons.push({ status: "low_activity", text: `Last active ${Math.floor(idle)} days ago` });
  }

  const order: HealthStatus[] = ["connection_issue", "needs_attention", "onboarding", "trial_expiring", "inactive", "low_activity"];
  const status = order.find((s) => reasons.some((r) => r.status === s)) ?? "healthy";
  return { status, reasons: reasons.map((r) => r.text) };
}

export type TrialState = "paid" | "active" | "expiring" | "expired" | "none";

export function trialState(trialEndsAt: string | null, paid: boolean, now: number = Date.now()): TrialState {
  if (paid) return "paid";
  if (!trialEndsAt) return "none";
  const left = Date.parse(trialEndsAt) - now;
  if (left <= 0) return "expired";
  return left <= HEALTH_RULES.trialExpiringWithinDays * DAY ? "expiring" : "active";
}

/** CSV with formula-injection protection (cells starting with = + - @ are prefixed). */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(","))].join("\r\n");
}
