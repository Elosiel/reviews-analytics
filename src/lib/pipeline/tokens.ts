/**
 * Token management for Google Business Profile OAuth.
 *
 * Rules:
 * - Tokens are stored AES-256-GCM encrypted in google_tokens.
 * - Refresh proactively if expires_at is within 5 minutes.
 * - On refresh failure: set location.connection_broken = true for all
 *   locations owned by that user, and mark the token row as broken.
 * - Never log or return raw token values.
 */

import { refreshAccessToken } from "@/lib/google/oauth";
import { encryptToken, decryptToken } from "@/lib/google/token-crypto";
import { GoogleReauthError } from "@/lib/google/errors";
import { logAppError, recordEvent } from "@/lib/telemetry/server";

// ── Get a valid access token for a user (refreshes if needed) ────

interface SupabaseClient {
  // Minimal interface — pass in the server supabase client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: row, error } = await supabase
    .from("google_tokens")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !row) {
    throw new GoogleReauthError(`No Google token found for user ${userId}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const REFRESH_BUFFER = 300; // refresh 5 min before expiry

  if (row.expires_at > now + REFRESH_BUFFER) {
    // Token still valid
    return decryptToken(row.access_token_enc);
  }

  // Need to refresh
  const refreshToken = decryptToken(row.refresh_token_enc);

  try {
    const newTokens = await refreshAccessToken(refreshToken);

    const newAccessEnc = encryptToken(newTokens.access_token);
    const newExpiresAt = now + (newTokens.expires_in ?? 3600);

    await supabase
      .from("google_tokens")
      .update({
        access_token_enc: newAccessEnc,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return newTokens.access_token;
  } catch (err) {
    // Refresh failed — mark all locations for this user as connection_broken
    console.error(`Token refresh failed for user ${userId}:`, err);

    await supabase
      .from("locations")
      .update({
        connection_broken: true,
        connection_broken_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const { data: owner } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    await Promise.all([
      recordEvent({ type: "google_connection_broken", tenantId: owner?.tenant_id ?? null, userId }),
      logAppError({ category: "google_auth", source: "google token refresh", error: err, tenantId: owner?.tenant_id ?? null, userId }),
    ]);

    throw new GoogleReauthError(
      `Google connection broken for user ${userId}. ` +
        `User will see in-app alert and must reconnect.`
    );
  }
}
