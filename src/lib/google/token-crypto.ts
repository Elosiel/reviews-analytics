/**
 * AES-256-GCM encrypt/decrypt for Google OAuth tokens stored in the
 * `google_tokens.access_token_enc` / `refresh_token_enc` bytea columns.
 *
 * Postgres (via PostgREST/Supabase-js) always represents bytea as a
 * "\x"-prefixed hex string in JSON, in both directions — write a plain
 * string in that form, read a plain string back in that form. Never hand
 * supabase-js a raw Buffer: Buffer's default JSON.stringify serializes to
 * `{"type":"Buffer","data":[...]}`, and that text — not the bytes — is what
 * would land in the column.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function bufferToBytea(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}

function byteaToBuffer(raw: string): Buffer {
  const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
  return Buffer.from(hex, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const combined = `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
  return bufferToBytea(Buffer.from(combined, "utf8"));
}

export function decryptToken(raw: string): string {
  const combined = byteaToBuffer(raw).toString("utf8");
  const [ivHex, tagHex, encHex] = combined.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Malformed encrypted token payload");
  }
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}
