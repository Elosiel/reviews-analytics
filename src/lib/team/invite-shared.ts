/**
 * Browser-safe team invite helpers (no Node APIs), shared by the login
 * page, invite page, and API routes. Dependency-free (no "@/" imports) so
 * the unit tests in tests/ run it directly under Node.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * A post-login redirect target taken from the URL. Only same-site paths are
 * allowed, so a crafted ?next= can't bounce a user to another domain.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}

/**
 * A name for the restaurant account, from its location names: the shared
 * word prefix for a group ("Terra Gaucha Brazilian Steakhouse - Tampa",
 * "... - Omaha" → "Terra Gaucha Brazilian Steakhouse"), else the first name.
 */
export function restaurantDisplayName(locationNames: string[]): string {
  const names = locationNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return "your restaurant";
  if (names.length === 1) return names[0];
  const words = names.map((n) => n.split(/\s+/));
  const shared: string[] = [];
  for (let i = 0; i < words[0].length; i++) {
    if (words.every((w) => w[i] === words[0][i])) shared.push(words[0][i]);
    else break;
  }
  const prefix = shared.join(" ").replace(/[\s\-–—|,:·]+$/, "");
  return prefix.length >= 3 ? prefix : `${names[0]} and ${names.length - 1} more`;
}

/** Whether an invite link can still be used (the database re-checks on accept). */
export function inviteLinkStatus(
  invite: { accepted_at: string | null; expires_at: string } | null,
  now: number = Date.now()
): "ready" | "invalid" | "used" | "expired" {
  if (!invite) return "invalid";
  if (invite.accepted_at) return "used";
  if (new Date(invite.expires_at).getTime() < now) return "expired";
  return "ready";
}

export type AcceptInviteResult =
  | "joined"
  | "already_member"
  | "not_signed_in"
  | "invalid"
  | "used"
  | "expired"
  | "wrong_email"
  | "email_unconfirmed"
  | "has_own_account";

export function acceptInviteMessage(result: string): string {
  switch (result) {
    case "joined":
    case "already_member":
      return "You're on the team.";
    case "not_signed_in":
      return "Sign in with the invited email to accept this invite.";
    case "used":
      return "This invite has already been used. Ask the account owner for a new one.";
    case "expired":
      return "This invite has expired. Ask the account owner to send a new one.";
    case "wrong_email":
      return "This invite was sent to a different email address. Sign in with the invited email.";
    case "email_unconfirmed":
      return "Confirm your email address first (check your inbox), then open this invite again.";
    case "has_own_account":
      return "This login already has its own restaurant account with data, so it can't join another team. Use a different email, or ask the owner to invite another address.";
    default:
      return "This invite link isn't valid. Ask the account owner for a new one.";
  }
}
