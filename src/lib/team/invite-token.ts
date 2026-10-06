/**
 * Server-only invite token helpers (Node crypto). Browser-safe helpers live
 * in invite-shared.ts. Dependency-free (no "@/" imports) for the unit tests.
 */
import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_DAYS = 14;

/** The secret that goes in the invite link. Only its hash is stored. */
export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
