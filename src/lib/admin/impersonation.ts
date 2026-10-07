import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Encrypts the admin's own refresh token while they're impersonating, so
// "Exit impersonation" can restore their (already two-factor) session
// without asking them to sign in again. AES-256-GCM with the existing
// TOKEN_ENCRYPTION_KEY; the cookie holding it is httpOnly + Secure.

export interface ImpersonationSecret {
  id: string;
  adminRefreshToken: string;
  exp: number;
}

function key(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  return Buffer.from(hex, "hex");
}

export function sealImpersonation(secret: ImpersonationSecret): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(secret), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function openImpersonation(sealed: string | undefined | null): ImpersonationSecret | null {
  if (!sealed) return null;
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    const s = JSON.parse(json);
    if (typeof s?.id !== "string" || typeof s?.adminRefreshToken !== "string") return null;
    return s as ImpersonationSecret;
  } catch {
    return null;
  }
}

/** The auth session id inside a Supabase access token (already verified by the auth server). */
export function sessionIdFromAccessToken(accessToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}
