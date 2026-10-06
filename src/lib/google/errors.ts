/**
 * Google connection errors → honest, actionable messages.
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

export const BUSINESS_PROFILE_SCOPE = "https://www.googleapis.com/auth/business.manage";

/** A non-2xx response from a Google Business Profile API endpoint. */
export class GbpApiError extends Error {
  readonly status: number;
  constructor(status: number, body: string) {
    // Message format is load-bearing: the sync route's 429 backoff matches on it.
    super(`GBP API error ${status}: ${body}`);
    this.name = "GbpApiError";
    this.status = status;
  }
}

/** The stored Google token is missing or Google refused to refresh it. */
export class GoogleReauthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleReauthError";
  }
}

export type GoogleErrorKind = "reconnect" | "permission" | "rate_limited" | "unavailable";

export interface GoogleErrorInfo {
  kind: GoogleErrorKind;
  message: string;
}

const RECONNECT_MESSAGE =
  "Google no longer accepts our access — it expired or was revoked. Reconnect your Google account to continue.";

export function describeGoogleError(err: unknown): GoogleErrorInfo {
  if (err instanceof GoogleReauthError) {
    return { kind: "reconnect", message: RECONNECT_MESSAGE };
  }
  if (err instanceof GbpApiError) {
    if (err.status === 401) return { kind: "reconnect", message: RECONNECT_MESSAGE };
    if (err.status === 403) {
      return {
        kind: "permission",
        message:
          "Google denied access to this Business Profile. Sign in with a Google account that owns or manages the listing, and keep Business Profile access selected on Google's screen.",
      };
    }
    if (err.status === 429) {
      return {
        kind: "rate_limited",
        message:
          "Google is limiting requests right now. Wait a minute and try again — if it keeps happening, contact support.",
      };
    }
  }
  return {
    kind: "unavailable",
    message: "We couldn't reach Google Business Profile. Try again in a moment.",
  };
}

/** True when Google's token response actually granted Business Profile access. */
export function hasBusinessProfileScope(grantedScope: string | null | undefined): boolean {
  return (grantedScope ?? "").split(/\s+/).includes(BUSINESS_PROFILE_SCOPE);
}

/** Message for the ?error= code the OAuth callback sends back to onboarding. */
export function oauthCallbackErrorMessage(code: string): string {
  switch (code) {
    case "access_denied":
      return "You chose not to grant access on Google's screen, so nothing was connected and nothing changed on your listing. You can try again whenever you're ready.";
    case "insufficient_scope":
      return "Google connected, but Business Profile access wasn't granted — that permission was unchecked on Google's screen. Try again and keep it selected; we only use it to read your locations and reviews.";
    case "invalid_state":
      return "This connection attempt expired or was started in another tab. Please start again.";
    default:
      return "The Google connection didn't complete. Please try again.";
  }
}
