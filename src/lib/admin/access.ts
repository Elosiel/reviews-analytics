/**
 * Super Admin authorization rules — pure, so they're unit-tested directly.
 * The server wrappers in ./auth.ts feed them verified JWT claims and the
 * caller's admin_users row (read with the service role, which customers can
 * never write).
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */

export const ADMIN_ROLES = ["super_admin", "support_admin", "billing_admin", "analytics_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** What each role may do. Only super_admin is granted today; the others are reserved. */
export type AdminCapability =
  | "view"
  | "export"
  | "manage_users"
  | "impersonate"
  | "manage_feedback"
  | "manage_notes"
  | "manage_trials"
  | "manage_accounts";

const CAPABILITIES: Record<AdminRole, readonly AdminCapability[]> = {
  super_admin: ["view", "export", "manage_users", "impersonate", "manage_feedback", "manage_notes", "manage_trials", "manage_accounts"],
  support_admin: ["view", "manage_users", "impersonate", "manage_feedback", "manage_notes"],
  billing_admin: ["view", "export", "manage_trials", "manage_notes"],
  analytics_admin: ["view", "export"],
};

export function roleCan(role: AdminRole, capability: AdminCapability): boolean {
  return CAPABILITIES[role]?.includes(capability) ?? false;
}

export interface VerifiedClaims {
  sub: string;
  email?: string;
  /** Authenticator assurance level: "aal2" once the session passed MFA. */
  aal?: string;
  session_id?: string;
}

export interface AdminRow {
  role: string;
  disabled_at: string | null;
}

export type AdminAccess =
  | { ok: true; role: AdminRole }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "mfa_required" };

/**
 * Admin access = a verified session + an active admin_users row + a session
 * that passed two-factor (aal2). Role is checked before MFA so a customer
 * never learns anything beyond "forbidden".
 */
export function decideAdminAccess(claims: VerifiedClaims | null, admin: AdminRow | null): AdminAccess {
  if (!claims?.sub) return { ok: false, reason: "unauthenticated" };
  if (!admin || admin.disabled_at || !(ADMIN_ROLES as readonly string[]).includes(admin.role)) {
    return { ok: false, reason: "forbidden" };
  }
  if (claims.aal !== "aal2") return { ok: false, reason: "mfa_required" };
  return { ok: true, role: admin.role as AdminRole };
}

export const IMPERSONATION_MINUTES = 30;
export const MIN_REASON_LENGTH = 10;

export function validImpersonationReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const r = reason.trim();
  return r.length >= MIN_REASON_LENGTH && r.length <= 500 ? r : null;
}
