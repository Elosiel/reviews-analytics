/**
 * Impersonation rules that both the middleware (edge) and server code use.
 * Pure and dependency-free so tests run it directly.
 *
 * Two httpOnly cookies exist only while an admin is impersonating:
 *   ra_imp      — AES-GCM-encrypted { id, adminRefreshToken, exp } (server only)
 *   ra_imp_meta — { id, exp, label } for the banner and expiry checks
 * Neither contains the customer's credentials; the customer's session is an
 * ordinary, separately revocable Supabase session.
 */

export const IMP_COOKIE = "ra_imp";
export const IMP_META_COOKIE = "ra_imp_meta";

export interface ImpersonationMeta {
  id: string;
  exp: number;
  label: string;
  tenantId: string | null;
}

export function parseImpersonationMeta(raw: string | undefined | null): ImpersonationMeta | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(decodeURIComponent(raw));
    if (typeof m?.id !== "string" || typeof m?.exp !== "number") return null;
    return { id: m.id, exp: m.exp, label: String(m.label ?? "").slice(0, 200), tenantId: m.tenantId ?? null };
  } catch {
    return null;
  }
}

export function encodeImpersonationMeta(m: ImpersonationMeta): string {
  return encodeURIComponent(JSON.stringify(m));
}

export function impersonationExpired(m: ImpersonationMeta, now: number = Date.now()): boolean {
  return now >= m.exp;
}

/** The only writes allowed while impersonating: telemetry and ending the session. */
const WRITE_ALLOWLIST = ["/api/events", "/api/super-admin/impersonation/end"];

/**
 * Impersonation is read-only. Any non-GET request — API routes, server
 * actions, form posts — is refused, except the allowlist. (The database
 * enforces the same rule for writes made straight from the browser.)
 */
export function impersonationBlocksRequest(method: string, pathname: string): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return !WRITE_ALLOWLIST.some((p) => pathname === p);
}
