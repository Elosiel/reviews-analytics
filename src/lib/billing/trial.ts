/**
 * Trial entitlement — the logic a future paywall asks "is this location still
 * free?". The dates themselves are persisted server-side (tenant_trials,
 * trial_extensions; set once at signup / by migration, never by the app on
 * user action), so adding locations, inviting teammates, reconnecting Google
 * or renaming anything can't move them.
 *
 *   Account trial:   trial_started_at = signup, trial_ends_at = signup + 30 days
 *   Extension:       one Google Business Profile location in one account gets an
 *                    explicit end date (Terra Gaucha Tampa: signup + 6 months)
 *
 * A location's trial end is its extension's end if that exact account +
 * GBP location has one, otherwise the account's. Display names never count.
 * A trial is active strictly before its end timestamp; at the end it's over.
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

export const STANDARD_TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccountTrial {
  tenantId: string;
  trialStartedAt: string;
  trialEndsAt: string;
}

export interface TrialExtension {
  tenantId: string;
  googleLocationId: string;
  trialEndsAt: string;
}

export interface TrialLocation {
  tenant_id: string;
  google_location_id: string;
}

export interface LocationTrial {
  trialEndsAt: string;
  active: boolean;
  source: "account" | "extension";
}

/** Signup + exactly 30 × 24 hours — what the signup trigger stores. */
export function standardTrialEndsAt(trialStartedAt: string): string {
  return new Date(Date.parse(trialStartedAt) + STANDARD_TRIAL_DAYS * DAY_MS).toISOString();
}

/**
 * Calendar-month arithmetic in UTC, matching Postgres `timestamptz +
 * interval 'N months'` on a UTC database: same day-of-month and time, clamped
 * to the last day when the target month is shorter (Aug 31 + 6 months →
 * Feb 28/29).
 */
export function addCalendarMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  target.setUTCHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return target.toISOString();
}

export function isTrialActive(trialEndsAt: string, now: number = Date.now()): boolean {
  return now < Date.parse(trialEndsAt);
}

export function locationTrial(
  location: TrialLocation,
  account: AccountTrial,
  extensions: TrialExtension[],
  now: number = Date.now()
): LocationTrial {
  const ext = extensions.find(
    (e) => e.tenantId === location.tenant_id && e.googleLocationId === location.google_location_id
  );
  // An extension never shortens the account's own trial.
  const useExt = ext && Date.parse(ext.trialEndsAt) > Date.parse(account.trialEndsAt);
  const trialEndsAt = useExt ? ext.trialEndsAt : account.trialEndsAt;
  return { trialEndsAt, active: isTrialActive(trialEndsAt, now), source: useExt ? "extension" : "account" };
}
